import {
  cookieDatabasesForBrowser,
  discoverCredentialsForBrowser,
  profileRootsForBrowser,
  type ChromiumBrowserConfig,
  type ChromiumCredentials,
} from "./chromium-cookies.ts";

export type ChromiumBrowserCredentials = ChromiumCredentials;

const CHROMIUM_CONFIG: ChromiumBrowserConfig = {
  keychainServiceName: "Chromium Safe Storage",
  secretToolApplication: "chromium",
  macAppSupportPath: ["Chromium"],
  linuxConfigDirName: "chromium",
  flatpakAppId: "org.chromium.Chromium",
  snapName: "chromium",
  profileEnvVar: "LUMO_CHROMIUM_PROFILE",
  snapshotPrefix: "pi-lumo-chromium-",
};

export function chromiumProfileRoots(
  home?: string,
  xdgConfigHome?: string,
  currentPlatform?: NodeJS.Platform,
): string[] {
  return profileRootsForBrowser(CHROMIUM_CONFIG, home, xdgConfigHome, currentPlatform);
}

export function discoverChromiumCredentials(
  databases: string[] = cookieDatabasesForBrowser(profileRootsForBrowser(CHROMIUM_CONFIG)),
): ChromiumBrowserCredentials | undefined {
  return discoverCredentialsForBrowser(CHROMIUM_CONFIG, databases);
}
