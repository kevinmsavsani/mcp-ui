import logging
import json
import os
import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"

class Logger:
    def __init__(self):
        log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
        self.log_level = getattr(logging, log_level_str, logging.INFO)
        self.enable_console = os.getenv("LOG_CONSOLE", "true").lower() == "true"
        
        self.logs = []
        self.max_logs = 1000
        
        # Configure standard logging
        logging.basicConfig(
            level=self.log_level,
            format='%(message)s'
        )
        self.logger = logging.getLogger("mcp_agent")

    def _format_log(self, level: LogLevel, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> Dict[str, Any]:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "context": context or {},
        }
        
        if error:
            log_entry["error"] = {
                "name": type(error).__name__,
                "message": str(error),
                # stack trace could be added here if needed
            }
            
        return log_entry

    def _write_log(self, level: LogLevel, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None):
        log_entry = self._format_log(level, message, context, error)
        
        # Store in memory
        self.logs.append(log_entry)
        if len(self.logs) > self.max_logs:
            self.logs.pop(0)
            
        # Console output
        if self.enable_console:
            color = ""
            if level == LogLevel.DEBUG: color = "\033[36m" # Cyan
            elif level == LogLevel.INFO: color = "\033[32m" # Green
            elif level == LogLevel.WARN: color = "\033[33m" # Yellow
            elif level == LogLevel.ERROR: color = "\033[31m" # Red
            
            reset = "\033[0m"
            context_str = f" | {json.dumps(context)}" if context else ""
            print(f"{color}[{log_entry['timestamp']}] [{level}] {message}{context_str}{reset}")
            if error:
                print(f"{color}{str(error)}{reset}")

    def debug(self, message: str, context: Optional[Dict[str, Any]] = None):
        self._write_log(LogLevel.DEBUG, message, context)

    def info(self, message: str, context: Optional[Dict[str, Any]] = None):
        self._write_log(LogLevel.INFO, message, context)

    def warn(self, message: str, context: Optional[Dict[str, Any]] = None):
        self._write_log(LogLevel.WARN, message, context)

    def error(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None):
        self._write_log(LogLevel.ERROR, message, context, error)

    def get_recent_logs(self, count: int = 100) -> List[Dict[str, Any]]:
        return self.logs[-count:]

logger = Logger()

class PerformanceMonitor:
    def __init__(self):
        self.metrics = {}

    def start_timer(self, operation: str):
        start_time = time.time()
        def end_timer():
            duration = (time.time() - start_time) * 1000 # to ms
            self.record_metric(operation, duration)
            return duration
        return end_timer

    def record_metric(self, operation: str, duration: float):
        if operation not in self.metrics:
            self.metrics[operation] = []
        
        self.metrics[operation].append(duration)
        if len(self.metrics[operation]) > 100:
            self.metrics[operation].pop(0)
            
        logger.debug(f"Performance metric recorded", {"operation": operation, "duration": duration, "unit": "ms"})

    def get_stats(self, operation: str) -> Optional[Dict[str, Any]]:
        metric_list = self.metrics.get(operation)
        if not metric_list:
            return None
            
        return {
            "avg": sum(metric_list) / len(metric_list),
            "min": min(metric_list),
            "max": max(metric_list),
            "count": len(metric_list)
        }

    def get_all_stats(self) -> Dict[str, Any]:
        return {op: self.get_stats(op) for op in self.metrics}

perf_monitor = PerformanceMonitor()
