# Auto Clicker

This folder contains the Chinese UI version of the Windows auto clicker.

Files:
- `AutoClicker.ps1`: main app
- `Launch-AutoClicker.bat`: double-click launcher
- `auto-clicker.log`: runtime log file created only when the app runs

Quick start:
1. Double-click `Launch-AutoClicker.bat`
2. Set the click rate
3. Choose left or right mouse button
4. Pick a toggle hotkey
5. Set the startup delay
6. Set the press duration in milliseconds
7. Click Start or press the hotkey
8. Wait for the countdown, move the mouse to the target area
9. Press `Esc` to stop immediately

Notes:
- The launcher now requests administrator permission when needed
- Some games only detect clicks if the press lasts for multiple milliseconds
