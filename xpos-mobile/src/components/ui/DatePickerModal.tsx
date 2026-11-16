import React, { useState, useMemo, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { haptics } from "@/utils/haptics";
import { Button } from "@/components/ui/Button";

export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value?: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  title?: string;
  minDate?: string;
  maxDate?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDateIso(str?: string): { year: number; month: number; day: number } {
  if (str && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split("-").map(Number);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function formatDateIso(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  value,
  onSelectDate,
  title = "Select Date",
  minDate,
  maxDate,
}) => {
  const { colors } = useTheme();

  const parsed = useMemo(() => parseDateIso(value), [value]);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [selectedDate, setSelectedDate] = useState(value || formatDateIso(parsed.year, parsed.month, parsed.day));

  // Sync view when opened or value changes
  useEffect(() => {
    if (visible) {
      const p = parseDateIso(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDate(value || formatDateIso(p.year, p.month, p.day));
    }
  }, [visible, value]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatDateIso(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const handlePrevMonth = () => {
    haptics.light();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    haptics.light();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    haptics.light();
    const dateStr = formatDateIso(viewYear, viewMonth, day);
    if (minDate && dateStr < minDate) return;
    if (maxDate && dateStr > maxDate) return;
    setSelectedDate(dateStr);
  };

  const handleJumpToday = () => {
    haptics.light();
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(todayStr);
  };

  const handleConfirm = () => {
    haptics.light();
    onSelectDate(selectedDate);
    onClose();
  };

  // Calendar calculations
  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    return { daysInMonth: totalDays, firstDayOfWeek: firstDay };
  }, [viewYear, viewMonth]);

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    // Blank padding days
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: null });
    }
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        dateStr: formatDateIso(viewYear, viewMonth, d),
      });
    }
    return cells;
  }, [viewYear, viewMonth, firstDayOfWeek, daysInMonth]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <CalendarIcon size={18} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month / Year navigation */}
          <View style={[styles.monthNav, { borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[styles.navArrow, { backgroundColor: colors.surfaceRaised }]}
            >
              <ChevronLeft size={18} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.monthYearText, { color: colors.text }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={[styles.navArrow, { backgroundColor: colors.surfaceRaised }]}
            >
              <ChevronRight size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((wd, i) => (
              <View key={i} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: colors.textSubtle }]}>{wd}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              if (cell.day === null || cell.dateStr === null) {
                return <View key={`blank-${idx}`} style={styles.dayCell} />;
              }

              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayStr;
              const isDisabled =
                (minDate ? cell.dateStr < minDate : false) ||
                (maxDate ? cell.dateStr > maxDate : false);

              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  disabled={isDisabled}
                  onPress={() => handleSelectDay(cell.day!)}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: colors.primary, borderRadius: 18 },
                    !isSelected && isToday && {
                      borderColor: colors.primary,
                      borderWidth: 1,
                      borderRadius: 18,
                    },
                    isDisabled && { opacity: 0.25 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? "#ffffff" : colors.text },
                      isSelected && { fontWeight: "700" },
                      isToday && !isSelected && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected Date Preview & Today quick jump */}
          <View style={[styles.previewBar, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
              Selected: <Text style={{ color: colors.primary, fontWeight: "700" }}>{selectedDate}</Text>
            </Text>
            <TouchableOpacity onPress={handleJumpToday} style={styles.todayBtn}>
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Today</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.btnRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Confirm"
              variant="primary"
              onPress={handleConfirm}
              style={{ flex: 1.4 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 6,
  },
  weekdayCell: {
    width: 38,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  dayCell: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
  },
  previewBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 14,
  },
  previewLabel: {
    fontSize: 12,
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
  },
});
