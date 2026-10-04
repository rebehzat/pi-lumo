import {
  cookieDatabasesForBrowser,
  discoverCredentialsForBrowser,
  profileRootsForBrowser,
  type ChromiumBrowserConfig,
  type ChromiumCredentials,
} from "./chromium-cookies.ts";

export type ChromeCredentials = ChromiumCredentials;

const CHROME_CONFIG: ChromiumBrowserConfig = {
  keychainServiceName: "Chrome Safe Storage",
  secretToolApplication: "chrome",
  macAppSupportPath: ["Google", "Chrome"],
  linuxConfigDirName: "google-chrome",
  flatpakAppId: "com.google.Chrome",
  profileEnvVar: "LUMO_CHROME_PROFILE",
  snapshotPrefix: "pi-lumo-chrome-",
};

export function chromeProfileRoots(
  home?: string,
  xdgConfigHome?: string,
  currentPlatform?: NodeJS.Platform,
): string[] {
  return profileRootsForBrowser(CHROME_CONFIG, home, xdgConfigHome, currentPlatform);
}

export function discoverChromeCredentials(
  databases: string[] = cookieDatabasesForBrowser(profileRootsForBrowser(CHROME_CONFIG)),
): ChromeCredentials | undefined {
  return discoverCredentialsForBrowser(CHROME_CONFIG, databases);
}
