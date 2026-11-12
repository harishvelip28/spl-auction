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
    title: "Player Registration Form (online)",
    description: "Fill in and submit the registration form online.",
    icon: "📝",
    link: "https://docs.google.com/forms/d/e/1FAIpQLScJV3UGvVjw1pbPeSPQPJLt4u9BTBC6Jwh7FCoe7f69f35sAQ/viewform",
    // disabled: true, // turned off for now — remove this line to enable
  },
  {
    title: "Player Form (printable)",
    description: "Download, print on A4, fill in and hand it to the organiser.",
    icon: "📄",
    drive: "1kFagpl3uIsQi1jm7Nn9hVpbaz9msnmQ_",
  },
  {
    title: "SPL Logo",
    description: "Official league logo for posters, jerseys and social media.",
    icon: "🏏",
    drive: "1NRODCxnYs4lZywwlvoQQbDWOKLDKkHMD",
  },
];

export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
export const downloadUrl = (file: string) => `${import.meta.env.BASE_URL}downloads/${encodeURIComponent(file)}`;
