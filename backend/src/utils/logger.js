/**
 * Logger Utility
 * Centralized logging with different levels and colors
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;

    if (data && !this.isProduction) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    return formatted;
  }

  info(message, data = null) {
    const formatted = this.formatMessage("INFO", message, data);
    console.log(`${colors.cyan}${formatted}${colors.reset}`);
  }

  success(message, data = null) {
    const formatted = this.formatMessage("SUCCESS", message, data);
    console.log(`${colors.green}✓ ${formatted}${colors.reset}`);
  }

  warn(message, data = null) {
    const formatted = this.formatMessage("WARN", message, data);
    console.warn(`${colors.yellow}⚠ ${formatted}${colors.reset}`);
  }

  error(message, error = null) {
    const formatted = this.formatMessage("ERROR", message);
    console.error(`${colors.red}✗ ${formatted}${colors.reset}`);

    if (error && !this.isProduction) {
      console.error(`${colors.red}${error.stack}${colors.reset}`);
    }
  }

  debug(message, data = null) {
    if (!this.isProduction) {
      const formatted = this.formatMessage("DEBUG", message, data);
      console.log(`${colors.magenta}${formatted}${colors.reset}`);
    }
  }

  http(method, url, status) {
    if (!this.isProduction) {
      const color =
        status >= 500
          ? colors.red
          : status >= 400
          ? colors.yellow
          : colors.green;
      console.log(`${color}[HTTP] ${method} ${url} - ${status}${colors.reset}`);
    }
  }
}

module.exports = new Logger();
