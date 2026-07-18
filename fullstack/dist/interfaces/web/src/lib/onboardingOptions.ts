// Curated pick-lists for onboarding. Multi-selects always let the traveler
// add anything missing via free text too, so these just need to cover the
// popular/common cases quickly — not be exhaustive.

export const GENDER_OPTIONS: { value: 'male' | 'female' | 'lgbtq+'; label: string; avatar: string }[] = [
  { value: 'male', label: 'Male', avatar: '/avatars/male.png' },
  { value: 'female', label: 'Female', avatar: '/avatars/female.png' },
  { value: 'lgbtq+', label: 'LGBTQ+', avatar: '/avatars/lgbtq+++.png' },
];

export function avatarForGender(gender?: string | null): string {
  const hit = GENDER_OPTIONS.find((g) => g.value === gender);
  return hit?.avatar || '/avatars/lgbtq+++.png';
}

// A self-uploaded photo always wins over the gender-default illustration.
export function avatarForUser(u?: { gender?: string | null; photoUrl?: string | null } | null): string {
  if (u?.photoUrl) return u.photoUrl;
  return avatarForGender(u?.gender);
}

export const POPULAR_GAMES: string[] = [
  // Shooters / battle royale
  'Valorant', 'Counter-Strike 2', 'Overwatch 2', 'Apex Legends', 'Fortnite',
  'Call of Duty: Warzone', 'Call of Duty: Modern Warfare', 'Rainbow Six Siege',
  'PUBG: Battlegrounds', 'Destiny 2', 'Halo Infinite', 'Titanfall 2',
  // MOBA / strategy
  'League of Legends', 'Dota 2', 'Teamfight Tactics', 'StarCraft II', 'Age of Empires IV', "Sid Meier's Civilization VI",
  // Sports / racing
  'Rocket League', 'EA Sports FC', 'NBA 2K', 'Madden NFL', 'F1', 'Gran Turismo', 'Forza Horizon', 'Mario Kart 8',
  // Fighting
  'Street Fighter 6', 'Tekken 8', 'Mortal Kombat 1', 'Super Smash Bros. Ultimate', 'Guilty Gear Strive',
  // RPG / open world
  'The Legend of Zelda', 'Elden Ring', 'Dark Souls III', "Baldur's Gate 3", 'Cyberpunk 2077', 'The Witcher 3',
  'The Elder Scrolls V: Skyrim', 'Genshin Impact', 'Honkai: Star Rail', 'Final Fantasy XIV', 'World of Warcraft',
  'Diablo IV', 'Path of Exile', 'Grand Theft Auto V', 'Red Dead Redemption 2', 'God of War Ragnarök',
  'The Last of Us Part II', 'Horizon Forbidden West', 'Pokémon',
  // Survival / sandbox
  'Minecraft', 'Roblox', 'Terraria', 'Palworld', 'Ark: Survival Ascended', 'Rust', 'Sea of Thieves',
  // Party / casual / cozy
  'Among Us', 'Fall Guys', 'It Takes Two', 'Stardew Valley', 'Animal Crossing: New Horizons', 'Overcooked 2', 'The Sims 4',
  // Card / collectible / mobile
  'Hearthstone', 'Marvel Snap', 'Pokémon GO', 'Clash of Clans', 'Clash Royale', 'Brawl Stars',
  'Mobile Legends: Bang Bang', 'Free Fire', 'Candy Crush Saga', 'Honor of Kings',
  // MMORPG / horror / other
  'Lost Ark', 'Black Desert Online', 'New World', 'Resident Evil', 'Phasmophobia', 'Dead by Daylight', 'Microsoft Flight Simulator',
];

export const POPULAR_MUSIC: string[] = [
  // Rock / metal
  'Slipknot', 'Linkin Park', 'System of a Down', 'Metallica', 'Korn', 'Evanescence',
  'Bring Me the Horizon', 'My Chemical Romance', 'Green Day', 'Foo Fighters', 'Twenty One Pilots', 'Thirty Seconds to Mars',
  // Latin rock / Latin pop / reggaeton
  'Panda (PXNDX)', 'Café Tacvba', 'Molotov', 'Zoé', 'Maná', 'Soda Stereo',
  'Bad Bunny', 'J Balvin', 'Karol G', 'Maluma', 'Juanes', 'Shakira', 'Ozuna', 'Daddy Yankee',
  'Rauw Alejandro', 'Feid', 'Camilo', 'Manu Chao', 'Reik', 'Carlos Vives', 'Marc Anthony', 'Romeo Santos', 'Peso Pluma',
  // Pop
  'Taylor Swift', 'Billie Eilish', 'Dua Lipa', 'Ariana Grande', 'Bruno Mars', 'Ed Sheeran',
  'Coldplay', 'Imagine Dragons', 'The Weeknd', 'Harry Styles', 'Olivia Rodrigo',
  // Hip-hop / R&B
  'Drake', 'Kendrick Lamar', 'Travis Scott', 'Post Malone', 'J. Cole', 'SZA', 'Rihanna',
  // K-pop
  'BTS', 'Blackpink', 'Stray Kids',
  // Electronic
  'Daft Punk', 'Calvin Harris', 'David Guetta', 'Marshmello',
];

export const COMMON_LANGUAGES: string[] = [
  'English', 'Spanish', 'Mandarin Chinese', 'Hindi', 'French', 'Arabic', 'Bengali', 'Portuguese',
  'Russian', 'Urdu', 'Indonesian', 'German', 'Japanese', 'Marathi', 'Telugu', 'Turkish', 'Tamil',
  'Cantonese', 'Vietnamese', 'Korean', 'Italian', 'Polish', 'Ukrainian', 'Tagalog / Filipino',
  'Persian / Farsi', 'Thai', 'Swahili', 'Dutch', 'Greek', 'Hebrew', 'Punjabi', 'Gujarati', 'Malay',
  'Romanian', 'Swedish', 'Czech', 'Hungarian', 'Serbian', 'Finnish', 'Norwegian', 'Danish', 'Haitian Creole',
];
