# Build stage
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B -q || true

COPY config ./config
COPY src ./src
RUN mvn clean package -B -DskipTests -q -Dspring-boot.repackage.excludeDevtools=true && \
    cp target/*.jar target/app.jar

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -g 1000 -S xpos && \
    adduser -u 1000 -S xpos -G xpos

WORKDIR /app

COPY --from=builder /build/target/app.jar ./app.jar

USER xpos

EXPOSE 9005

ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
