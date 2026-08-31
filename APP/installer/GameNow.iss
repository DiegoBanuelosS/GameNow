#define MyAppName "GameNow"
#define MyAppVersion "1.0.0"
#define SetupUI "..\..\SETUP\build\windows\x64\runner\Release"

[Setup]
AppId={{8E2C1A6B-4F71-4D3A-9C8E-2B0A7D5E91F3}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName=GameNow
AppPublisher=GameNow
DefaultDirName={localappdata}\GameNowInstaller
DisableWelcomePage=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableFinishedPage=yes
Uninstallable=no
CreateUninstallRegKey=no
OutputDir=..\..\WWW\public\downloads
OutputBaseFilename=GameNow-Setup
SetupIconFile=..\windows\runner\resources\app_icon.ico
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern dark hidebevels
WizardBackColor=#000000
SetupLogging=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#SetupUI}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{app}\gamenow_setup.exe"; Flags: waituntilterminated

[Code]
function InitializeSetup: Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if not WizardSilent then
  begin
    Exec(ExpandConstant('{srcexe}'), '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Result := False;
  end;
end;
