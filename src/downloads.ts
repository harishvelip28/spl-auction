/* ═══════════════════════════════════════════════════════════════════
   PUBLIC DOWNLOADS (shown at /#downloads, no login needed)

   To add or change a file:
     1. Put the file in  public/downloads/  (e.g. public/downloads/spl-logo.png)
     2. Add or edit an entry below with  file: "spl-logo.png"
   For an online link (e.g. Google Form) use  link: "https://..."  instead.
   For a Google Drive file use  drive: "<file id>"  (the long id in the share link).
   Entries with an empty file/link are hidden, so unfinished ones don't show.
═══════════════════════════════════════════════════════════════════ */

export interface DownloadItem {
  title: string;
  description: string;
  icon: string;
  file?: string;  // name of a file inside public/downloads/
  link?: string;  // external URL, opened in a new tab
  drive?: string; // Google Drive file ID (file must be shared "Anyone with the link")
  disabled?: boolean; // show the card but grey out its button
}

export const DOWNLOADS: DownloadItem[] = [
  {
    title: "Shigao Premier League – Player Registration Form (online)",
    description: "Fill in and submit the SPL registration form online.",
    icon: "📝",
    link: "https://docs.google.com/forms/d/e/1FAIpQLScJV3UGvVjw1pbPeSPQPJLt4u9BTBC6Jwh7FCoe7f69f35sAQ/viewform",
  },
  {
    title: "Dharbandora Cricket League – Player Registration Form (online)",
    description: "Fill in and submit the DCL registration form online.",
    icon: "📝",
    link: "https://docs.google.com/forms/d/e/1FAIpQLScf47ogrqMZbXE34T-746SJz2-o9p0dy7FWKgOAtJRVq0Natg/viewform",
  },
  {
    title: "Shigao Premier League – Player Form (printable)",
    description: "Download, print on A4, fill in and hand it to the organiser.",
    icon: "📄",
    drive: "1kFagpl3uIsQi1jm7Nn9hVpbaz9msnmQ_",
  },
  {
    title: "Dharbandora Cricket League – Player Form (printable)",
    description: "Download, print on A4, fill in and hand it to the organiser.",
    icon: "📄",
    file: "dcl-player-form.png",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   LOGO PACKS — one button per league on the downloads page; it opens
   that league's logo and its team logos, each downloadable.

   To add a logo: put the image in  public/downloads/logos/<league>/
   and set  file: "logos/<league>/<name>.png"  below.
   Entries with an empty file are hidden until the image is added.
   For a new league, copy the SPL block and change the names and files.
═══════════════════════════════════════════════════════════════════ */

export interface LogoItem { title: string; file: string; }
export interface LeagueLogos { league: string; logos: LogoItem[]; }

export const LEAGUE_LOGOS: LeagueLogos[] = [
  {
    league: "Shigao Premier League",
    logos: [
      { title: "Shigao Premier League", file: "logos/spl/shigao-premier-league.png" },
      { title: "Ajoba Warrior's",       file: "logos/spl/ajoba-warriors.jpeg" },
      { title: "Parthvik Jaguar's",     file: "logos/spl/parthvik-jaguars.jpeg" },
      { title: "Shrisha Striker's",     file: "logos/spl/shrisha-strikers.jpeg" },
      { title: "Shrisha Warrior's",     file: "logos/spl/shrisha-warriors.jpeg" },
      { title: "Mandev Cricketer's",    file: "logos/spl/mandev-cricketers.jpeg" },
      { title: "MSC Warrior's",         file: "logos/spl/msc-warriors.jpeg" },
    ],
  },
];

export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
export const downloadUrl = (file: string) => `${import.meta.env.BASE_URL}downloads/${file.split("/").map(encodeURIComponent).join("/")}`;
