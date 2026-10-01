# GraviQuota - Antigravity Token Extraction Script (Windows)
# Extracts Antigravity Google access token or refresh token and copies to clipboard.

[CmdletBinding()]
param(
    [switch]$RefreshToken
)

$ErrorActionPreference = 'Stop'

try {
    # Check if advapi32 CredRead definition is already loaded in current session
    if (-not ([System.Management.Automation.PSTypeName]'GraviQuotaCredReader').Type) {
        $signature = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class GraviQuotaCredReader {
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr credentialPtr);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string ReadGenericCredential(string target) {
        IntPtr ptr;
        if (CredRead(target, 1, 0, out ptr)) {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            byte[] blob = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, blob, 0, cred.CredentialBlobSize);
            CredFree(ptr);
            return Encoding.UTF8.GetString(blob);
        }
        return null;
    }
}
"@
        Add-Type -TypeDefinition $signature -Language CSharp
    }

    $raw = [GraviQuotaCredReader]::ReadGenericCredential('gemini:antigravity')

    if (-not $raw) {
        Write-Error "No Antigravity credentials found in Windows Credential Manager. Ensure you are signed in to Antigravity IDE."
        exit 1
    }

    $credJson = $raw | ConvertFrom-Json
    $targetToken = ""

    if ($RefreshToken.IsPresent -and $credJson.token.refresh_token) {
        $targetToken = $credJson.token.refresh_token
        Write-Host "Found permanent Antigravity Refresh Token." -ForegroundColor Cyan
    } elseif ($credJson.token.access_token) {
        $targetToken = $credJson.token.access_token
        Write-Host "Found active Antigravity Access Token." -ForegroundColor Cyan
    }

    if (-not $targetToken) {
        Write-Error "Token field was not found in Antigravity credential payload."
        exit 1
    }

    Set-Clipboard -Value $targetToken
    Write-Host "Token successfully copied to your clipboard!" -ForegroundColor Green
    Write-Host "Paste it into the GraviQuota token input to synchronize your quota." -ForegroundColor Yellow
} catch {
    Write-Error "Failed to extract Antigravity token: $_"
    exit 1
}
