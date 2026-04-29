param(
    [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeMethods {
    public const uint INPUT_MOUSE = 0;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)]
        public MOUSEINPUT mi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern IntPtr GetMessageExtraInfo();

    public static bool SendMouseEvent(uint eventFlag) {
        INPUT[] inputs = new INPUT[1];

        inputs[0].type = INPUT_MOUSE;
        inputs[0].U.mi.dwFlags = eventFlag;
        inputs[0].U.mi.dwExtraInfo = GetMessageExtraInfo();

        return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) == inputs.Length;
    }

    public static int GetLastErrorCode() {
        return Marshal.GetLastWin32Error();
    }
}
"@

    function New-UiText {
        param(
            [int[]]$CodePoints
        )

        return (-join ($CodePoints | ForEach-Object { [char]$_ }))
    }

    $uiText = @{
        MouseMiddle  = New-UiText @(40736, 26631, 20013, 38190)
        Side1        = New-UiText @(20391, 38190, 49)
        Side2        = New-UiText @(20391, 38190, 50)
        LeftButton   = New-UiText @(40736, 26631, 24038, 38190)
        RightButton  = New-UiText @(40736, 26631, 21491, 38190)
        Running      = New-UiText @(36816, 34892, 20013)
        Stopped      = New-UiText @(24050, 20572, 27490)
        Pending      = New-UiText @(20934, 22791, 24320, 22987, 65292, 21097, 20313, 32)
        SummaryStart = New-UiText @(28909, 38190, 58, 32)
        SummaryEnd   = New-UiText @(32, 32, 32, 124, 32, 32, 32, 25353, 32, 69, 83, 67, 32, 31435, 21363, 20572, 27490)
        DelaySuffix  = New-UiText @(32, 31186)
        WindowTitle  = New-UiText @(33258, 21160, 36830, 28857, 22120)
        Title        = New-UiText @(26700, 38754, 33258, 21160, 36830, 28857, 22120)
        RateLabel    = New-UiText @(27599, 31186, 28857, 20987, 27425, 25968)
        ButtonLabel  = New-UiText @(28857, 20987, 25353, 38190)
        HotkeyLabel  = New-UiText @(20999, 25442, 28909, 38190)
        DelayLabel   = New-UiText @(21551, 21160, 24310, 36831, 40, 31186, 41)
        PressLabel   = New-UiText @(25353, 19979, 26102, 38271, 40, 109, 115, 41)
        StatusLabel  = New-UiText @(24403, 21069, 29366, 24577)
        Hint         = New-UiText @(28857, 20987, 8220, 24320, 22987, 8221, 21518, 20250, 20808, 20498, 35745, 26102, 65292, 35831, 20999, 22238, 28216, 25103, 31383, 21475, 20877, 24320, 22987, 65307, 33509, 28216, 25103, 20026, 31649, 29702, 21592, 26435, 38480, 65292, 35831, 20801, 35768, 32, 85, 65, 67, 32, 25552, 31034, 12290)
        Start        = New-UiText @(24320, 22987)
        Stop         = New-UiText @(20572, 27490)
        Exit         = New-UiText @(36864, 20986)
        ErrorTitle   = New-UiText @(33258, 21160, 36830, 28857, 22120, 38169, 35823)
        LogPrefix    = New-UiText @(26085, 24535, 65306, 32)
    }

    [void][System.Windows.Forms.Application]::EnableVisualStyles()

    $logPath = Join-Path -Path $PSScriptRoot -ChildPath "auto-clicker.log"
    $mouseLeftDown = 0x0002
    $mouseLeftUp = 0x0004
    $mouseRightDown = 0x0008
    $mouseRightUp = 0x0010
    $escapeKey = 0x1B

    $hotkeys = [ordered]@{
        "F6"                   = 0x75
        "F7"                   = 0x76
        "F8"                   = 0x77
        "F9"                   = 0x78
        "F10"                  = 0x79
        "F11"                  = 0x7A
        "F12"                  = 0x7B
        "Pause"                = 0x13
        $uiText["MouseMiddle"] = 0x04
        $uiText["Side1"]       = 0x05
        $uiText["Side2"]       = 0x06
    }

    $clickButtons = @($uiText["LeftButton"], $uiText["RightButton"])

    $state = [pscustomobject]@{
        Running             = $false
        PendingStart        = $false
        IntervalMs          = 100
        StartDelayMs        = 2000
        PressDurationMs     = 30
        StartAt             = 0L
        NextClickAt         = 0L
        ReleaseAt           = 0L
        MouseButtonDown     = $false
        HeldButton          = ""
        ToggleKeyDown       = $false
        EscapeKeyDown       = $false
        LastCountdownSecond = -1
        UseLegacyClick      = $false
        LegacyClickLogged   = $false
    }

    $clock = [System.Diagnostics.Stopwatch]::StartNew()

    function Write-Log {
        param(
            [string]$Message
        )

        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
        Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f $timestamp, $Message)
    }

    function Play-Feedback {
        param(
            [ValidateSet("armed", "start", "stop")]
            [string]$Kind
        )

        try {
            switch ($Kind) {
                "armed" { [System.Media.SystemSounds]::Asterisk.Play() }
                "start" { [System.Media.SystemSounds]::Beep.Play() }
                "stop"  { [System.Media.SystemSounds]::Exclamation.Play() }
            }
        }
        catch {
        }
    }

    function Get-SelectedHotkeyCode {
        return [int]$hotkeys[[string]$hotkeyComboBox.SelectedItem]
    }

    function Update-Interval {
        $cps = [double]$rateInput.Value
        $state.IntervalMs = [Math]::Max(1, [int][Math]::Round(1000.0 / $cps))
    }

    function Update-Delay {
        $state.StartDelayMs = [Math]::Max(500, [int][Math]::Round([double]$delayInput.Value * 1000.0))
    }

    function Update-PressDuration {
        $state.PressDurationMs = [Math]::Max(1, [int][Math]::Round([double]$pressDurationInput.Value))
    }

    function Get-EffectivePressDuration {
        return [Math]::Max(1, [Math]::Min($state.PressDurationMs, [Math]::Max(1, $state.IntervalMs - 1)))
    }

    function Get-CountdownSeconds {
        $remainingMs = [Math]::Max(0, $state.StartAt - $clock.ElapsedMilliseconds)
        return [int][Math]::Ceiling($remainingMs / 1000.0)
    }

    function Update-Status {
        if ($state.Running) {
            $statusValueLabel.Text = $uiText["Running"]
            $statusValueLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 128, 0)
        }
        elseif ($state.PendingStart) {
            $statusValueLabel.Text = ("{0}{1}{2}" -f $uiText["Pending"], (Get-CountdownSeconds), $uiText["DelaySuffix"])
            $statusValueLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 120, 0)
        }
        else {
            $statusValueLabel.Text = $uiText["Stopped"]
            $statusValueLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 0, 0)
        }

        $summaryLabel.Text = ("{0}{1}{2}" -f $uiText["SummaryStart"], [string]$hotkeyComboBox.SelectedItem, $uiText["SummaryEnd"])
    }

    function Show-Error {
        param(
            [string]$Message
        )

        $fullMessage = $Message
        if (Test-Path -LiteralPath $logPath) {
            $fullMessage = "{0}`r`n`r`n{1}{2}" -f $Message, $uiText["LogPrefix"], $logPath
        }

        [System.Windows.Forms.MessageBox]::Show(
            $fullMessage,
            $uiText["ErrorTitle"],
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }

    function Send-MouseAction {
        param(
            [string]$Button,
            [ValidateSet("Down", "Up")]
            [string]$Action
        )

        $eventFlag = $mouseLeftDown
        if ($Button -eq $uiText["RightButton"]) {
            $eventFlag = $mouseRightDown
        }

        if ($Action -eq "Up") {
            $eventFlag = if ($Button -eq $uiText["RightButton"]) { $mouseRightUp } else { $mouseLeftUp }
        }

        if (-not $state.UseLegacyClick) {
            if ([NativeMethods]::SendMouseEvent($eventFlag)) {
                return
            }

            $state.UseLegacyClick = $true
            if (-not $state.LegacyClickLogged) {
                $state.LegacyClickLogged = $true
                Write-Log ("SendInput failed with error code {0}, falling back to mouse_event" -f [NativeMethods]::GetLastErrorCode())
            }
        }

        [NativeMethods]::mouse_event($eventFlag, 0, 0, 0, [UIntPtr]::Zero)
    }

    function Release-HeldButton {
        if (-not $state.MouseButtonDown) {
            return
        }

        $buttonToRelease = $state.HeldButton
        if ([string]::IsNullOrWhiteSpace($buttonToRelease)) {
            $buttonToRelease = [string]$buttonComboBox.SelectedItem
        }

        Send-MouseAction -Button $buttonToRelease -Action "Up"
        $state.MouseButtonDown = $false
        $state.HeldButton = ""
    }

    function Start-Clicking {
        Update-Interval
        Update-PressDuration
        $state.PendingStart = $false
        $state.Running = $true
        $state.MouseButtonDown = $false
        $state.HeldButton = ""
        $state.NextClickAt = $clock.ElapsedMilliseconds
        Update-Status
        Play-Feedback -Kind "start"
        Write-Log ("Started with {0} cps, button={1}, hotkey={2}, hold={3}ms, mode={4}" -f [double]$rateInput.Value, [string]$buttonComboBox.SelectedItem, [string]$hotkeyComboBox.SelectedItem, (Get-EffectivePressDuration), $(if ($state.UseLegacyClick) { "mouse_event" } else { "SendInput" }))
    }

    function Arm-Clicking {
        Update-Interval
        Update-Delay
        $state.Running = $false
        $state.PendingStart = $true
        $state.StartAt = $clock.ElapsedMilliseconds + $state.StartDelayMs
        $state.LastCountdownSecond = -1
        Update-Status
        Play-Feedback -Kind "armed"
        Write-Log ("Armed with delay={0}ms, cps={1}, button={2}, hotkey={3}" -f $state.StartDelayMs, [double]$rateInput.Value, [string]$buttonComboBox.SelectedItem, [string]$hotkeyComboBox.SelectedItem)
    }

    function Stop-Clicking {
        param(
            [string]$Reason = "manual"
        )

        $wasActive = $state.Running -or $state.PendingStart
        $state.Running = $false
        $state.PendingStart = $false
        $state.LastCountdownSecond = -1
        Release-HeldButton
        Update-Status

        if ($wasActive) {
            Play-Feedback -Kind "stop"
            Write-Log ("Stopped ({0})" -f $Reason)
        }
    }

    function Toggle-Clicking {
        param(
            [string]$Reason = "toggle"
        )

        if ($state.Running -or $state.PendingStart) {
            Stop-Clicking -Reason $Reason
        }
        else {
            Arm-Clicking
        }
    }

    $form = New-Object System.Windows.Forms.Form
    $form.Text = $uiText["WindowTitle"]
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ClientSize = New-Object System.Drawing.Size(430, 340)

    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Location = New-Object System.Drawing.Point(20, 18)
    $titleLabel.Size = New-Object System.Drawing.Size(390, 24)
    $titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $titleLabel.Text = $uiText["Title"]

    $rateLabel = New-Object System.Windows.Forms.Label
    $rateLabel.Location = New-Object System.Drawing.Point(20, 58)
    $rateLabel.Size = New-Object System.Drawing.Size(140, 22)
    $rateLabel.Text = $uiText["RateLabel"]

    $rateInput = New-Object System.Windows.Forms.NumericUpDown
    $rateInput.Location = New-Object System.Drawing.Point(180, 56)
    $rateInput.Size = New-Object System.Drawing.Size(120, 24)
    $rateInput.Minimum = [decimal]0.5
    $rateInput.Maximum = [decimal]100
    $rateInput.DecimalPlaces = 1
    $rateInput.Increment = [decimal]0.5
    $rateInput.Value = [decimal]10

    $buttonLabel = New-Object System.Windows.Forms.Label
    $buttonLabel.Location = New-Object System.Drawing.Point(20, 96)
    $buttonLabel.Size = New-Object System.Drawing.Size(140, 22)
    $buttonLabel.Text = $uiText["ButtonLabel"]

    $buttonComboBox = New-Object System.Windows.Forms.ComboBox
    $buttonComboBox.Location = New-Object System.Drawing.Point(180, 92)
    $buttonComboBox.Size = New-Object System.Drawing.Size(150, 24)
    $buttonComboBox.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
    [void]$buttonComboBox.Items.AddRange($clickButtons)
    $buttonComboBox.SelectedItem = $uiText["LeftButton"]

    $hotkeyLabel = New-Object System.Windows.Forms.Label
    $hotkeyLabel.Location = New-Object System.Drawing.Point(20, 134)
    $hotkeyLabel.Size = New-Object System.Drawing.Size(140, 22)
    $hotkeyLabel.Text = $uiText["HotkeyLabel"]

    $hotkeyComboBox = New-Object System.Windows.Forms.ComboBox
    $hotkeyComboBox.Location = New-Object System.Drawing.Point(180, 130)
    $hotkeyComboBox.Size = New-Object System.Drawing.Size(150, 24)
    $hotkeyComboBox.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
    [void]$hotkeyComboBox.Items.AddRange([string[]]$hotkeys.Keys)
    $hotkeyComboBox.SelectedItem = "F8"

    $delayLabel = New-Object System.Windows.Forms.Label
    $delayLabel.Location = New-Object System.Drawing.Point(20, 172)
    $delayLabel.Size = New-Object System.Drawing.Size(140, 22)
    $delayLabel.Text = $uiText["DelayLabel"]

    $delayInput = New-Object System.Windows.Forms.NumericUpDown
    $delayInput.Location = New-Object System.Drawing.Point(180, 168)
    $delayInput.Size = New-Object System.Drawing.Size(120, 24)
    $delayInput.Minimum = [decimal]0.5
    $delayInput.Maximum = [decimal]10
    $delayInput.DecimalPlaces = 1
    $delayInput.Increment = [decimal]0.5
    $delayInput.Value = [decimal]2

    $pressLabel = New-Object System.Windows.Forms.Label
    $pressLabel.Location = New-Object System.Drawing.Point(20, 210)
    $pressLabel.Size = New-Object System.Drawing.Size(140, 22)
    $pressLabel.Text = $uiText["PressLabel"]

    $pressDurationInput = New-Object System.Windows.Forms.NumericUpDown
    $pressDurationInput.Location = New-Object System.Drawing.Point(180, 206)
    $pressDurationInput.Size = New-Object System.Drawing.Size(120, 24)
    $pressDurationInput.Minimum = [decimal]1
    $pressDurationInput.Maximum = [decimal]500
    $pressDurationInput.DecimalPlaces = 0
    $pressDurationInput.Increment = [decimal]5
    $pressDurationInput.Value = [decimal]30

    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Location = New-Object System.Drawing.Point(20, 248)
    $statusLabel.Size = New-Object System.Drawing.Size(140, 22)
    $statusLabel.Text = $uiText["StatusLabel"]

    $statusValueLabel = New-Object System.Windows.Forms.Label
    $statusValueLabel.Location = New-Object System.Drawing.Point(180, 248)
    $statusValueLabel.Size = New-Object System.Drawing.Size(180, 22)
    $statusValueLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)

    $summaryLabel = New-Object System.Windows.Forms.Label
    $summaryLabel.Location = New-Object System.Drawing.Point(20, 280)
    $summaryLabel.Size = New-Object System.Drawing.Size(390, 18)
    $summaryLabel.Text = ""

    $hintLabel = New-Object System.Windows.Forms.Label
    $hintLabel.Location = New-Object System.Drawing.Point(20, 302)
    $hintLabel.Size = New-Object System.Drawing.Size(390, 36)
    $hintLabel.Text = $uiText["Hint"]

    $startButton = New-Object System.Windows.Forms.Button
    $startButton.Location = New-Object System.Drawing.Point(340, 54)
    $startButton.Size = New-Object System.Drawing.Size(70, 28)
    $startButton.Text = $uiText["Start"]

    $stopButton = New-Object System.Windows.Forms.Button
    $stopButton.Location = New-Object System.Drawing.Point(340, 90)
    $stopButton.Size = New-Object System.Drawing.Size(70, 28)
    $stopButton.Text = $uiText["Stop"]

    $exitButton = New-Object System.Windows.Forms.Button
    $exitButton.Location = New-Object System.Drawing.Point(340, 126)
    $exitButton.Size = New-Object System.Drawing.Size(70, 28)
    $exitButton.Text = $uiText["Exit"]

    $rateInput.Add_ValueChanged({
        Update-Interval
    })

    $delayInput.Add_ValueChanged({
        Update-Delay
        if ($state.PendingStart) {
            Arm-Clicking
        }
    })

    $pressDurationInput.Add_ValueChanged({
        Update-PressDuration
    })

    $hotkeyComboBox.Add_SelectedIndexChanged({
        Update-Status
    })

    $startButton.Add_Click({
        Arm-Clicking
    })

    $stopButton.Add_Click({
        Stop-Clicking -Reason "button"
    })

    $exitButton.Add_Click({
        $form.Close()
    })

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 10
    $timer.Add_Tick({
        try {
            $togglePressed = ([NativeMethods]::GetAsyncKeyState((Get-SelectedHotkeyCode)) -band 0x8000) -ne 0
            if ($togglePressed -and -not $state.ToggleKeyDown) {
                Toggle-Clicking -Reason "hotkey"
            }
            $state.ToggleKeyDown = $togglePressed

            $escapePressed = ([NativeMethods]::GetAsyncKeyState($escapeKey) -band 0x8000) -ne 0
            if ($escapePressed -and -not $state.EscapeKeyDown) {
                Stop-Clicking -Reason "escape"
            }
            $state.EscapeKeyDown = $escapePressed

            if ($state.PendingStart) {
                $secondsLeft = Get-CountdownSeconds
                if ($secondsLeft -ne $state.LastCountdownSecond) {
                    $state.LastCountdownSecond = $secondsLeft
                    Update-Status
                }

                if ($clock.ElapsedMilliseconds -ge $state.StartAt) {
                    Start-Clicking
                }
                else {
                    return
                }
            }

            if (-not $state.Running) {
                return
            }

            $now = $clock.ElapsedMilliseconds
            if ($state.MouseButtonDown -and $now -ge $state.ReleaseAt) {
                Release-HeldButton
            }

            if ($state.MouseButtonDown) {
                return
            }

            if ($now -lt $state.NextClickAt) {
                return
            }

            $activeButton = [string]$buttonComboBox.SelectedItem
            Send-MouseAction -Button $activeButton -Action "Down"
            $state.MouseButtonDown = $true
            $state.HeldButton = $activeButton
            $state.ReleaseAt = $now + (Get-EffectivePressDuration)

            do {
                $state.NextClickAt += $state.IntervalMs
            } while ($state.NextClickAt -le $now)
        }
        catch {
            $timer.Stop()
            Stop-Clicking -Reason "tick-error"
            Write-Log ("Unhandled tick error: {0}" -f $_.Exception.ToString())
            Show-Error -Message $_.Exception.Message
        }
    })

    $form.Add_FormClosing({
        $timer.Stop()
        Stop-Clicking -Reason "closing"
    })

    $form.Controls.Add($titleLabel)
    $form.Controls.Add($rateLabel)
    $form.Controls.Add($rateInput)
    $form.Controls.Add($buttonLabel)
    $form.Controls.Add($buttonComboBox)
    $form.Controls.Add($hotkeyLabel)
    $form.Controls.Add($hotkeyComboBox)
    $form.Controls.Add($delayLabel)
    $form.Controls.Add($delayInput)
    $form.Controls.Add($pressLabel)
    $form.Controls.Add($pressDurationInput)
    $form.Controls.Add($statusLabel)
    $form.Controls.Add($statusValueLabel)
    $form.Controls.Add($summaryLabel)
    $form.Controls.Add($hintLabel)
    $form.Controls.Add($startButton)
    $form.Controls.Add($stopButton)
    $form.Controls.Add($exitButton)

    Update-Interval
    Update-Delay
    Update-PressDuration
    Update-Status
    Write-Log "Application started"

    if ($SelfTest) {
        Write-Output "Self-test passed"
        return
    }

    $timer.Start()
    [System.Windows.Forms.Application]::Run($form)
}
catch {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        $fallbackPath = Join-Path -Path $PSScriptRoot -ChildPath "auto-clicker.log"
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
        Add-Content -LiteralPath $fallbackPath -Value ("[{0}] Fatal error: {1}" -f $timestamp, $_.Exception.ToString())
        [System.Windows.Forms.MessageBox]::Show(
            ("{0}`r`n`r`n{1}{2}" -f $_.Exception.Message, "Log: ", $fallbackPath),
            "Auto Clicker Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    catch {
    }

    throw
}
