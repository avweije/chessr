<?php
namespace App\Library;

class Timer
{
    private float $startTime;
    private float $lastTime;
    private array $subTimes = [];

    private array $debugVars = [];

    public function debugVar($name, $var) 
    {
        $this->debugVars[] = ["name" => $name, "debug" => $var];
    }

    public function startProcess(): void
    {
        $this->startTime = microtime(true);
        $this->lastTime = $this->startTime;
        $this->subTimes = [];
    }

    public function endProcess(string $label = 'total'): void
    {
        $now = microtime(true);
        $this->subTimes[$label] = ($now - $this->startTime);
        $this->lastTime = $now;
    }

    public function startSub(string $name): void
    {
        $this->subTimes[$name]['start'] = microtime(true);
    }

    public function stopSub(string $name): void
    {
        $now = microtime(true);
        if (!isset($this->subTimes[$name]['total'])) {
            $this->subTimes[$name]['total'] = 0;
        }
        $this->subTimes[$name]['total'] += $now - $this->subTimes[$name]['start'];
        unset($this->subTimes[$name]['start']);
    }

    private function formatTime(float $seconds): string
    {
        $minutes = floor($seconds / 60);
        $secs = floor($seconds % 60);
        $ms = round(($seconds - floor($seconds)) * 1000);
        if ($minutes > 0) {
            return "{$minutes}m {$secs}s {$ms}ms";
        }
        return "{$secs}s {$ms}ms";
    }

    public function getReport(): array
    {
        $report = [];
        foreach ($this->subTimes as $name => $value) {
            if (is_array($value) && isset($value['total'])) {
                $seconds = $value['total'];
            } elseif (is_numeric($value)) {
                $seconds = $value;
            } else {
                continue;
            }

            $report[$name] = [
                'seconds' => $seconds,
                'readable' => $this->formatTime($seconds)
            ];
        }

        $report['debugVars'] = $this->debugVars;

        return $report;
    }
}