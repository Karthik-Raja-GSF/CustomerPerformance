import { Label } from "@/shadcn/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select"
import { LLM_MODELS } from "@/types/prompts"

interface ModelSelectorProps {
  value: string
  onValueChange: (value: string) => void
}

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="model-select">LLM Model</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="model-select">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {LLM_MODELS.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
