import { Gtk } from "ags/gtk4";
import { createPoll } from "ags/time";
import { readFile as readTextFile } from "ags/file";

type Stats = {
    cpu: number;
    ramUsed: string;
    ramPercent: number;
    power: string;
};

// Helper to safely read files
function readFile(path: string): string | undefined {
    try {
        return readTextFile(path);
    } catch {
        return undefined;
    }
}

// CPU Usage
let prevTotal = 0;
let prevIdle = 0;

function getCpuUsage(): number {
    const content = readFile("/proc/stat");
    if (!content) return 0;

    const line = content.split("\n").find(l => l.startsWith("cpu "));
    if (!line) return 0;

    const nums = line.trim().split(/\s+/).slice(1).map(Number);
    const idle = nums[3] + nums[4];
    const total = nums.reduce((a, b) => a + b, 0);

    if (prevTotal === 0) {
        prevTotal = total;
        prevIdle = idle;
        return 0;
    }

    const deltaTotal = total - prevTotal;
    const deltaIdle = idle - prevIdle;
    prevTotal = total;
    prevIdle = idle;

    return deltaTotal > 0 ? Math.round(((deltaTotal - deltaIdle) / deltaTotal) * 100) : 0;
}

// RAM Usage
function getRamUsage() {
    const content = readFile("/proc/meminfo");
    if (!content) return { ramUsed: "0GB", ramPercent: 0 };

    const total = parseInt(content.match(/MemTotal:\s+(\d+)/)?.[1] || "0");
    const avail = parseInt(content.match(/MemAvailable:\s+(\d+)/)?.[1] || "0");

    const usedKiB = total - avail;
    const usedGB = (usedKiB / 1024 / 1024).toFixed(1);
    const percent = total > 0 ? Math.round((usedKiB / total) * 100) : 0;

    return { ramUsed: `${usedGB}GB`, ramPercent: percent };
}

// Power Draw
function getPowerDraw(): string {
    const paths = ["/sys/class/power_supply/BAT0", "/sys/class/power_supply/BAT1", "/sys/class/power_supply/BATT"];
    for (const base of paths) {
        const power = readFile(`${base}/power_now`);
        if (power) {
            const w = parseInt(power) / 1_000_000;
            if (w > 0) return `${w.toFixed(1)}W`;
        }
    }
    return "--";
}

// Poll every second
const stats = createPoll<Stats>({
    cpu: 0,
    ramUsed: "0GB",
    ramPercent: 0,
    power: "--",
}, 1000, () => ({
    cpu: getCpuUsage(),
    ...getRamUsage(),
    power: getPowerDraw(),
}));

export const SystemStats = () => (
    <Gtk.Box class={"system-stats"} spacing={6}>
        <Gtk.Label label={stats.as(s => `CPU ${s.cpu}%`)}   widthRequest={72} xalign={0} />
        <Gtk.Label label={stats.as(s => `RAM ${s.ramUsed} (${s.ramPercent}%)`)} widthRequest={110} xalign={0} />
        <Gtk.Label label={stats.as(s => `PWR ${s.power}`)} widthRequest={68} xalign={0} />
    </Gtk.Box>
);