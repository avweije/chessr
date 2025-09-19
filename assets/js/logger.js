export class Logger {
    static enabled = new Set();    // enabled modules
    static globalEnabled = true;  // if true, show all
    static allDisabled = false;    // if true, mute everything
    static useStackTrace = true;  // toggle caller info (slower)

    constructor(moduleName) {
        this.moduleName = moduleName;
    }

    // --- core output helper ---
    _print(method, caller, args) {
        if (Logger.allDisabled) return;
        if (!(Logger.globalEnabled || Logger.enabled.has(this.moduleName))) return;

        // Get the function and file/line
        const callerFunc = caller ? caller.function : null;
        const callerLine = caller ? caller.line : null;
        const callerFileLine = caller ? caller.fileLink : null;
        // Set the console message
        const msg = `[${this.moduleName}]` 
            + (callerFunc ? `[${callerFunc}]` : '') 
            + (callerLine ? `[${callerLine}]` : '');

        //if (callerFileLine) args.push(callerFileLine);

        console[method](...args, msg);
        //console[method](`[${this.moduleName}]`, ...args);
    }

    // --- public methods ---
    log(...args) {
        const caller = Logger.useStackTrace ? Logger.getCallerLocation() : null;
        this._print("log", caller, args);
    }

    info(...args) {
        const caller = Logger.useStackTrace ? Logger.getCallerLocation() : null;
        this._print("info", caller, args);
    }

    warn(...args) {
        const caller = Logger.useStackTrace ? Logger.getCallerLocation() : null;
        this._print("warn", caller, args);
    }

    error(...args) {
        const caller = Logger.useStackTrace ? Logger.getCallerLocation() : null;
        this._print("error", caller, args);
    }

    // --- control ---
    static enable(moduleName) {
        Logger.enabled.add(moduleName);
    }

    static disable(moduleName) {
        Logger.enabled.delete(moduleName);
    }

    static enableAll() {
        Logger.globalEnabled = true;
    }

    static disableAll() {
        Logger.globalEnabled = false;
    }

    static silence() {
        Logger.allDisabled = true;
    }

    static unsilence() {
        Logger.allDisabled = false;
    }

    // --- helper for stack trace ---
    static getCallerLocation() {
        const err = new Error();
        if (!err.stack) return "";
        const lines = err.stack.split("\n");

        // caller is usually lines[3] (log -> _print -> caller)
        const callerLine = (lines[3] || lines[2] || "").trim();

        // parse function name, file, line, column
        const match = callerLine.match(/at (\S+) \((.*):(\d+):(\d+)\)/);
        if (match) {
            //const funcName = match[1];
            const funcName = match[1].split('.').pop(); // just function name, not class
            //const file = match[2].split("/").pop(); // just filename
            const file = match[2];
            const line = match[3];
            //const column = match[4];

            // format like clickable DevTools link
            //return `${funcName} (${file}:${line}:${column})`;
            return { 
                function: funcName, 
                file: file,
                line: line,
                fileLink: `${file}:${line}` };
            //return `${funcName} (${file}:${line})`;
        }

        return null;
    }
}