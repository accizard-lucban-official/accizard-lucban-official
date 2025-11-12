import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (date: DateRange | undefined) => void
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const currentYear = new Date().getFullYear()

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range)

    if (range?.from && range?.to) {
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal relative",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "MM/dd/yy")} -{" "}
                  {format(value.to, "MM/dd/yy")}
                </>
              ) : (
                format(value.from, "MM/dd/yy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
            {value?.from && value?.to && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-auto mr-2 h-4 w-4 flex items-center justify-center rounded-sm hover:bg-gray-200 text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground", value?.from && value?.to && "hidden")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            numberOfMonths={2}
            captionLayout="dropdown"
            fromYear={2000}
            toYear={currentYear + 5}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
} 