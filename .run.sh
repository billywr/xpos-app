#!/usr/bin/env bash
# ==============================================================================
# XPOS Monorepo Service Runner (.run.sh)
#
# Runs both backend (xpos) and frontend (xpos-ui) concurrently with clean
# color-coded logs and graceful shutdown on Ctrl+C.
#
# Usage:
#   ./.run.sh               # Run both xpos (backend) and xpos-ui (frontend)
#   ./.run.sh --infra       # Start Docker infra (Postgres, Keycloak) first, then run apps
#   ./.run.sh --backend     # Run only xpos backend
#   ./.run.sh --ui          # Run only xpos-ui frontend
#   ./.run.sh --docker      # Run full stack using docker compose
#   ./.run.sh --help        # Show usage options
# ==============================================================================

set -m # Enable job control to manage process groups cleanly

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XPOS_DIR="${SCRIPT_DIR}/xpos"
UI_DIR="${SCRIPT_DIR}/xpos-ui"

# Default Ports
BACKEND_PORT="${BACKEND_PORT:-9003}"
UI_PORT="${UI_PORT:-5173}"

# ANSI Colors
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_CYAN="\033[36m"
CLR_GREEN="\033[32m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"
CLR_BLUE="\033[34m"

log_info() {
    printf "${CLR_BOLD}${CLR_BLUE}[runner]${CLR_RESET} %s\n" "$1"
}

log_warn() {
    printf "${CLR_BOLD}${CLR_YELLOW}[runner:warn]${CLR_RESET} %s\n" "$1"
}

log_error() {
    printf "${CLR_BOLD}${CLR_RED}[runner:error]${CLR_RESET} %s\n" "$1"
}

log_success() {
    printf "${CLR_BOLD}${CLR_GREEN}[runner]${CLR_RESET} %s\n" "$1"
}

# Pipe output line-by-line with colored prefix
prefix_stream() {
    local color="$1"
    local tag="$2"
    local buf_cmd=""
    if command -v stdbuf >/dev/null 2>&1; then
        buf_cmd="stdbuf -oL -eL"
    fi

    $buf_cmd awk -v c="$color" -v t="$tag" -v r="$CLR_RESET" '
        {
            print c "[" t "]" r " " $0
            fflush()
        }
    '
}

# Discover listening PIDs on a TCP port
get_port_pids() {
    local port="$1"
    local pids=""

    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    fi

    if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
        pids=$(ss -lptn "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
    fi

    if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
        pids=$(fuser "$port"/tcp 2>/dev/null || true)
    fi

    echo "$pids" | tr '\n' ' ' | (grep -oE '[0-9]+' || true) | sort -u | tr '\n' ' ' | xargs
}

# Close any process listening on a specified port
free_port() {
    local port="$1"
    local service_name="$2"
    local pids
    pids=$(get_port_pids "$port")

    if [ -n "$pids" ]; then
        log_warn "Port ${port} (${service_name}) is in use by PID(s): ${pids}. Closing existing process..."
        for pid in $pids; do
            kill -TERM "$pid" 2>/dev/null || true
        done

        # Wait up to 3 seconds for graceful shutdown
        local wait_count=0
        while [ $wait_count -lt 3 ]; do
            local still_alive=0
            for pid in $pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    still_alive=1
                    break
                fi
            done
            if [ $still_alive -eq 0 ]; then
                break
            fi
            sleep 1
            wait_count=$((wait_count + 1))
        done

        # Force kill if still lingering
        for pid in $pids; do
            if kill -0 "$pid" 2>/dev/null; then
                log_warn "Process ${pid} on port ${port} did not terminate gracefully; force killing (SIGKILL)..."
                kill -9 "$pid" 2>/dev/null || true
            fi
        done

        sleep 0.5
        local remaining
        remaining=$(get_port_pids "$port")
        if [ -n "$remaining" ]; then
            log_error "Could not free port ${port}. Process(es) still running: ${remaining}. You may need to terminate them manually."
        else
            log_success "Port ${port} (${service_name}) freed."
        fi
    fi
}

show_help() {
    echo -e "${CLR_BOLD}XPOS Monorepo Runner${CLR_RESET}

${CLR_BOLD}Usage:${CLR_RESET}
  ./.run.sh [options]

${CLR_BOLD}Options:${CLR_RESET}
  -h, --help        Show this help message and exit
  -i, --infra       Start PostgreSQL & Keycloak containers first, then launch apps
  -b, --backend     Start backend (xpos) only
  -u, --ui          Start frontend (xpos-ui) only
  -d, --docker      Start full stack via Docker Compose (xpos/docker-compose.yml)
  --clean           Run Maven clean before starting backend

${CLR_BOLD}Endpoints (Default Dev):${CLR_RESET}
  Backend API:      http://localhost:${BACKEND_PORT}/api/v1 (Actuator: http://localhost:${BACKEND_PORT}/actuator/health)
  Frontend UI:      http://localhost:${UI_PORT}
  Keycloak IAM:     http://localhost:8088 (dev) / http://localhost:8080 (compose)
"
}

# Child process tracking
BACKEND_PID=""
UI_PID=""

cleanup() {
    # Disable trap to avoid recursive invocation
    trap - INT TERM EXIT
    printf "\n"
    log_info "Stopping services..."

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        log_info "Stopping xpos backend (PID: $BACKEND_PID)..."
        kill -TERM -"$BACKEND_PID" 2>/dev/null || kill -TERM "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$UI_PID" ] && kill -0 "$UI_PID" 2>/dev/null; then
        log_info "Stopping xpos-ui frontend (PID: $UI_PID)..."
        kill -TERM -"$UI_PID" 2>/dev/null || kill -TERM "$UI_PID" 2>/dev/null || true
    fi

    # Wait up to 3 seconds for graceful shutdown
    local wait_count=0
    while [ $wait_count -lt 3 ]; do
        local still_running=0
        if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then still_running=1; fi
        if [ -n "$UI_PID" ] && kill -0 "$UI_PID" 2>/dev/null; then still_running=1; fi
        if [ $still_running -eq 0 ]; then break; fi
        sleep 1
        wait_count=$((wait_count + 1))
    done

    # Force kill if still lingering
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill -9 -"$BACKEND_PID" 2>/dev/null || kill -9 "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$UI_PID" ] && kill -0 "$UI_PID" 2>/dev/null; then
        kill -9 -"$UI_PID" 2>/dev/null || kill -9 "$UI_PID" 2>/dev/null || true
    fi

    # Ensure ports are released even if child processes detached
    if [ "$RUN_BACKEND" -eq 1 ]; then
        local bpids
        bpids=$(get_port_pids "$BACKEND_PORT")
        if [ -n "$bpids" ]; then
            for pid in $bpids; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
    fi
    if [ "$RUN_UI" -eq 1 ]; then
        local upids
        upids=$(get_port_pids "$UI_PORT")
        if [ -n "$upids" ]; then
            for pid in $upids; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
    fi

    log_success "All services stopped."
    exit 0
}

check_prerequisites() {
    # Check Java
    if ! command -v java >/dev/null 2>&1; then
        log_error "Java is not installed or not in PATH. Java 21 is required for xpos."
        exit 1
    fi

    # Check Node & npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "Node.js / npm is not installed or not in PATH. Required for xpos-ui."
        exit 1
    fi

    # Check mvnw wrapper
    if [ ! -f "${XPOS_DIR}/mvnw" ]; then
        log_error "Maven wrapper (${XPOS_DIR}/mvnw) not found."
        exit 1
    fi
}

start_infra() {
    log_info "Starting infrastructure containers (PostgreSQL & Keycloak)..."
    if [ -f "${XPOS_DIR}/docker-compose.yml" ]; then
        docker compose -f "${XPOS_DIR}/docker-compose.yml" up -d postgres keycloak
        log_success "Infrastructure containers initiated."
    else
        log_warn "docker-compose.yml not found in ${XPOS_DIR}. Skipping infra startup."
    fi
}

run_docker_compose() {
    log_info "Starting full stack via Docker Compose..."
    if [ -f "${XPOS_DIR}/docker-compose.yml" ]; then
        docker compose -f "${XPOS_DIR}/docker-compose.yml" up "$@"
    else
        log_error "docker-compose.yml not found in ${XPOS_DIR}."
        exit 1
    fi
}

# Mode flags
RUN_BACKEND=1
RUN_UI=1
START_INFRA=0
DO_CLEAN=0
DOCKER_MODE=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -i|--infra)
            START_INFRA=1
            shift
            ;;
        -b|--backend)
            RUN_BACKEND=1
            RUN_UI=0
            shift
            ;;
        -u|--ui|--frontend)
            RUN_BACKEND=0
            RUN_UI=1
            shift
            ;;
        -d|--docker)
            DOCKER_MODE=1
            shift
            ;;
        --clean)
            DO_CLEAN=1
            shift
            ;;
        *)
            log_error "Unknown option: $1 (run with --help for usage)"
            exit 1
            ;;
    esac
done

if [ "$DOCKER_MODE" -eq 1 ]; then
    run_docker_compose
    exit $?
fi

check_prerequisites

if [ "$START_INFRA" -eq 1 ]; then
    start_infra
fi

# Ensure node_modules installed
if [ "$RUN_UI" -eq 1 ] && [ ! -d "${UI_DIR}/node_modules" ]; then
    log_info "Installing npm dependencies in xpos-ui..."
    (cd "${UI_DIR}" && npm install)
fi

# Setup exit trap
trap cleanup INT TERM EXIT

# Close ports in use before starting services
if [ "$RUN_BACKEND" -eq 1 ]; then
    free_port "$BACKEND_PORT" "xpos backend"
fi
if [ "$RUN_UI" -eq 1 ]; then
    free_port "$UI_PORT" "xpos-ui"
fi

log_info "Starting XPOS services..."
log_info "Press Ctrl+C at any time to shut down all processes."

# Start Backend
if [ "$RUN_BACKEND" -eq 1 ]; then
    log_info "Launching xpos backend on http://localhost:${BACKEND_PORT}..."
    MVN_CMD="./mvnw spring-boot:run"
    if [ "$DO_CLEAN" -eq 1 ]; then
        MVN_CMD="./mvnw clean spring-boot:run"
    fi
    (
        cd "${XPOS_DIR}"
        exec $MVN_CMD 2>&1 | prefix_stream "$CLR_CYAN" "xpos"
    ) &
    BACKEND_PID=$!
fi

# Start Frontend
if [ "$RUN_UI" -eq 1 ]; then
    log_info "Launching xpos-ui on http://localhost:${UI_PORT}..."
    (
        cd "${UI_DIR}"
        exec npm run dev 2>&1 | prefix_stream "$CLR_GREEN" "xpos-ui"
    ) &
    UI_PID=$!
fi

# Wait for background processes
wait
