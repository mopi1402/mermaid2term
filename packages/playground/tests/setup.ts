// The host's background hints are cleared, so no test reads the machine's own terminal.

for (const name of ["TERMINAL_BACKGROUND", "TERMINAL_COLOR_SCHEME", "COLORFGBG"]) delete process.env[name];
