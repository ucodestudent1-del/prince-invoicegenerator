"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Clock, Play, Pause, Square, Save, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { createManualTimeEntry } from "@/lib/actions/time-tracking";

interface Project {
  id: string;
  name: string;
}

interface TimerState {
  isRunning: boolean;
  startTime: Date | null;
  elapsed: number;
  selectedProject: string;
  description: string;
  billable: boolean;
  hourlyRate: string;
}

export function TimerBar({ projects }: { projects: Project[] }) {
  const [timer, setTimer] = React["useState"]<TimerState>({
    isRunning: false,
    startTime: null,
    elapsed: 0,
    selectedProject: projects[0]?.["id"] || "",
    description: "",
    billable: true,
    hourlyRate: "",
  });
  const [showManualForm, setShowManualForm] = React["useState"](false);
  const intervalRef = React["useRef"]<NodeJS.Timeout | null>(null);

  React["useEffect"](() => {
    if (timer["isRunning"]) {
      intervalRef["current"] = setInterval(() => {
        setTimer((prev) => ({
          ...prev,
          elapsed: Date["now"]() - prev["startTime"]!["getTime"](),
        }));
      }, 1000);
    } else if (intervalRef["current"]) {
      clearInterval(intervalRef["current"]);
    }
    return () => {
      if (intervalRef["current"]) clearInterval(intervalRef["current"]);
    };
  }, [timer["isRunning"]]);

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math["floor"](ms / 1000);
    const hours = Math["floor"](totalSeconds / 3600);
    const minutes = Math["floor"]((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours["toString"]()["padStart"](2, "0")}:${minutes["toString"]()["padStart"](2, "0")}:${seconds["toString"]()["padStart"](2, "0")}`;
  };

  const startTimer = () => {
    setTimer((prev) => ({
      ...prev,
      isRunning: true,
      startTime: new Date(),
      elapsed: 0,
    }));
  };

  const stopTimer = () => {
    setTimer((prev) => ({
      ...prev,
      isRunning: false,
    }));
  };

  const pauseTimer = () => {
    setTimer((prev) => ({
      ...prev,
      isRunning: false,
    }));
  };

  const resumeTimer = () => {
    setTimer((prev) => ({
      ...prev,
      isRunning: true,
      startTime: new Date(Date["now"]() - prev["elapsed"]),
    }));
  };

  const saveEntry = async () => {
    try {
      const duration = timer["elapsed"];
      await createManualTimeEntry({
        projectId: timer["selectedProject"],
        startTime: new Date()["toISOString"](),
        duration: Math["floor"](duration / 1000),
        description: timer["description"],
        billable: timer["billable"],
        hourlyRate: Number(timer["hourlyRate"]) || 0,
      });
      setTimer({
        isRunning: false,
        startTime: null,
        elapsed: 0,
        selectedProject: projects[0]?.["id"] || "",
        description: "",
        billable: true,
        hourlyRate: "",
      });
    } catch (err: any) {
      console["error"]("Failed to save time entry:", err);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e["preventDefault"]();
    const formData = new FormData(e["currentTarget"]);
    try {
      await createManualTimeEntry({
        projectId: formData["get"]("projectId") as string,
        startTime: formData["get"]("startTime") as string,
        endTime: (formData["get"]("endTime") as string) || null,
        duration: formData["get"]("duration") ? Number(formData["get"]("duration")) * 3600 : undefined,
        description: (formData["get"]("description") as string) || null,
        billable: formData["get"]("billable") === "true",
        hourlyRate: Number(formData["get"]("hourlyRate")) || 0,
        isManual: true,
      });
      setShowManualForm(false);
      e["currentTarget"]["reset"]();
    } catch (err: any) {
      console["error"]("Failed to save manual entry:", err);
    }
  };

  if (showManualForm) {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Manual Time Entry</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={handleManualSubmit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="projectId">Project *</Label>
            <Select name="projectId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects["map"]((p) => (
                  <SelectItem key={p["id"]} value={p["id"]}>{p["name"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="startTime">Start Time *</Label>
            <Input id="startTime" type="datetime-local" name="startTime" required />
          </div>
          <div>
            <Label htmlFor="endTime">End Time</Label>
            <Input id="endTime" type="datetime-local" name="endTime" />
          </div>
          <div>
            <Label htmlFor="duration">Duration (hours) *</Label>
            <Input id="duration" type="number" name="duration" step="0.1" min="0" placeholder="e.g. 2.5" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="What did you work on?" />
          </div>
          <div>
            <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
            <Input id="hourlyRate" type="number" name="hourlyRate" step="0.01" min="0" placeholder="e.g. 100" />
          </div>
          <div className="flex items-end">
            <Label className="flex items-center gap-2">
              <input type="checkbox" name="billable" value="true" defaultChecked />
              Billable
            </Label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowManualForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <span className="font-mono text-lg">{formatElapsed(timer["elapsed"])}</span>

        {timer["isRunning"] ? (
          <>
            <Button variant="outline" size="sm" onClick={pauseTimer}>
              <Pause className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={stopTimer}>
              <Square className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {timer["elapsed"] > 0 ? (
              <Button size="sm" onClick={resumeTimer}>
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={startTimer}>
                <Play className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {timer["isRunning"] && (
          <>
            <Select
              value={timer["selectedProject"]}
              onValueChange={(val) => setTimer((p) => ({ ...p, selectedProject: val }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects["map"]((p) => (
                  <SelectItem key={p["id"]} value={p["id"]}>{p["name"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Description"
              value={timer["description"]}
              onChange={(e) => setTimer((p) => ({ ...p, description: e["target"]["value"] }))}
              className="w-48 text-sm"
            />
            <Input
              type="number"
              placeholder="Rate ($/hr)"
              value={timer["hourlyRate"]}
              onChange={(e) => setTimer((p) => ({ ...p, hourlyRate: e["target"]["value"] }))}
              className="w-24 text-sm"
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={timer["billable"]}
                onChange={(e) => setTimer((p) => ({ ...p, billable: e["target"]["checked"] }))}
              />
              Billable
            </label>
            <span className="text-sm font-medium">
              = {formatCurrency((timer["elapsed"] / 3600000) * (Number(timer["hourlyRate"]) || 0))}
            </span>
            <Button size="sm" onClick={saveEntry}>
              <Save className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {!timer["isRunning"] && timer["elapsed"] === 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowManualForm(true)}>
          <Clock className="h-4 w-4 mr-1" /> Manual Entry
        </Button>
      )}
    </Card>
  );
}
