from pathlib import Path

# --- Paths ---
ROOT = Path(__file__).parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
DATA_OUTPUT = ROOT / "data" / "output"

WIKI_CACHE_PATH = DATA_RAW / "wikipedia_cache.json"
OPENCRITIC_CACHE_PATH = DATA_PROCESSED / "opencritic_cache.json"
IGDB_RAW_PATH = DATA_PROCESSED / "igdb_raw.csv"

OUTPUT_CSV = DATA_OUTPUT / "squareenix_games.csv"
QUALITY_REPORT = DATA_OUTPUT / "data_quality_report.txt"
MANUAL_REVIEW = DATA_OUTPUT / "manual_review.csv"

# --- API endpoints ---
IGDB_BASE_URL = "https://api.igdb.com/v4"
IGDB_AUTH_URL = "https://id.twitch.tv/oauth2/token"
OPENCRITIC_BASE_URL = "https://api.opencritic.com/api"
OPENCRITIC_RATE_LIMIT_DELAY = 1.2

# IGDB company IDs — verified via /companies search endpoint
# Run igdb_client.verify_company_ids() on first use to confirm these
IGDB_COMPANY_IDS = {
    "Squaresoft": 70,
    "Enix": 71,
    "Square Enix": 58,
}

OUTPUT_SCHEMA_COLUMNS = [
    "title", "company_era", "developer", "series", "genre", "subgenre",
    "dimension", "platform", "platform_family", "platform_type",
    "release_year", "region", "sales", "critic_score", "user_score",
    "exclusivity_status", "nintendo_relationship_era", "japan_only",
]

# --- Platform normalization ---
PLATFORM_MAP = {
    # PlayStation family
    "PlayStation": "PS1",
    "PSX": "PS1",
    "PS": "PS1",
    "PS1": "PS1",
    "PlayStation 2": "PS2",
    "PS2": "PS2",
    "PlayStation 3": "PS3",
    "PS3": "PS3",
    "PlayStation 4": "PS4",
    "PS4": "PS4",
    "PlayStation 5": "PS5",
    "PS5": "PS5",
    "PlayStation Portable": "PSP",
    "PSP": "PSP",
    "PlayStation Vita": "PS Vita",
    "PS Vita": "PS Vita",
    "Vita": "PS Vita",
    # Nintendo family
    "NES": "NES",
    "Nintendo Entertainment System": "NES",
    "Family Computer": "NES",
    "Famicom": "NES",
    "Super Nintendo": "SNES",
    "Super NES": "SNES",
    "SNES": "SNES",
    "Super Famicom": "SNES",
    "Super Nintendo Entertainment System": "SNES",
    "SFC": "SNES",
    "Game Boy": "Game Boy",
    "GB": "Game Boy",
    "Game Boy Color": "GBC",
    "GBC": "GBC",
    "Game Boy Advance": "GBA",
    "GBA": "GBA",
    "Nintendo 64": "N64",
    "N64": "N64",
    "GameCube": "GameCube",
    "Nintendo GameCube": "GameCube",
    "GCN": "GameCube",
    "GC": "GameCube",
    "Nintendo DS": "DS",
    "DS": "DS",
    "NDS": "DS",
    "Nintendo 3DS": "3DS",
    "3DS": "3DS",
    "New Nintendo 3DS": "3DS",
    "Wii": "Wii",
    "Nintendo Wii": "Wii",
    "Wii U": "Wii U",
    "Nintendo Wii U": "Wii U",
    "Nintendo Switch": "Switch",
    "Switch": "Switch",
    "NS": "Switch",
    # Microsoft
    "Xbox": "Xbox",
    "Microsoft Xbox": "Xbox",
    "Xbox 360": "Xbox 360",
    "X360": "Xbox 360",
    "Xbox One": "Xbox One",
    "XOne": "Xbox One",
    "Xbox Series X": "Xbox Series X/S",
    "Xbox Series S": "Xbox Series X/S",
    "Xbox Series X/S": "Xbox Series X/S",
    "XSX": "Xbox Series X/S",
    # PC
    "PC": "PC",
    "Windows": "PC",
    "Steam": "PC",
    "PC Windows": "PC",
    "Microsoft Windows": "PC",
    "MS-DOS": "PC",
    "DOS": "PC",
    "Mac": "Mac",
    "macOS": "Mac",
    "Macintosh": "Mac",
    # Sega
    "Sega Genesis": "Genesis",
    "Genesis": "Genesis",
    "Mega Drive": "Genesis",
    "MD": "Genesis",
    "Sega Saturn": "Saturn",
    "Saturn": "Saturn",
    "SAT": "Saturn",
    "Sega Dreamcast": "Dreamcast",
    "Dreamcast": "Dreamcast",
    "DC": "Dreamcast",
    "Sega CD": "Sega CD",
    "Mega-CD": "Sega CD",
    # Mobile
    "iOS": "Mobile",
    "Android": "Mobile",
    "Mobile": "Mobile",
    "iPhone": "Mobile",
    "iPad": "Mobile",
    # Other
    "Arcade": "Arcade",
    "WonderSwan": "WonderSwan",
    "WonderSwan Color": "WonderSwan",
    "WSC": "WonderSwan",
    "MSX": "MSX",
    "MSX2": "MSX",
    "PC-88": "PC-88",
    "PC-98": "PC-98",
    "Sharp X68000": "X68000",
    "X68000": "X68000",
    "FM Towns": "FM Towns",
}

# --- Platform family ---
PLATFORM_FAMILY_MAP = {
    "PS1": "PlayStation", "PS2": "PlayStation", "PS3": "PlayStation",
    "PS4": "PlayStation", "PS5": "PlayStation", "PSP": "PlayStation",
    "PS Vita": "PlayStation",
    "NES": "Nintendo", "SNES": "Nintendo", "N64": "Nintendo",
    "Game Boy": "Nintendo", "GBC": "Nintendo", "GBA": "Nintendo",
    "GameCube": "Nintendo", "DS": "Nintendo", "3DS": "Nintendo",
    "Wii": "Nintendo", "Wii U": "Nintendo", "Switch": "Nintendo",
    "Xbox": "Microsoft", "Xbox 360": "Microsoft",
    "Xbox One": "Microsoft", "Xbox Series X/S": "Microsoft",
    "PC": "PC", "Mac": "PC",
    "Genesis": "Sega", "Saturn": "Sega", "Dreamcast": "Sega", "Sega CD": "Sega",
    "Mobile": "Mobile",
    "Arcade": "Other", "WonderSwan": "Other", "MSX": "Other",
    "PC-88": "Other", "PC-98": "Other", "X68000": "Other", "FM Towns": "Other",
}

# --- Platform type ---
PLATFORM_TYPE_MAP = {
    "NES": "Home Console", "SNES": "Home Console", "N64": "Home Console",
    "GameCube": "Home Console", "Wii": "Home Console", "Wii U": "Home Console",
    "Switch": "Home Console",
    "Game Boy": "Handheld", "GBC": "Handheld", "GBA": "Handheld",
    "DS": "Handheld", "3DS": "Handheld", "PSP": "Handheld", "PS Vita": "Handheld",
    "WonderSwan": "Handheld",
    "PS1": "Home Console", "PS2": "Home Console", "PS3": "Home Console",
    "PS4": "Home Console", "PS5": "Home Console",
    "Xbox": "Home Console", "Xbox 360": "Home Console",
    "Xbox One": "Home Console", "Xbox Series X/S": "Home Console",
    "Genesis": "Home Console", "Saturn": "Home Console",
    "Dreamcast": "Home Console", "Sega CD": "Home Console",
    "PC": "PC", "Mac": "PC",
    "MSX": "PC", "PC-88": "PC", "PC-98": "PC", "X68000": "PC", "FM Towns": "PC",
    "Mobile": "Mobile",
    "Arcade": "Arcade",
}

# --- Manual dimension lookup ---
# Keys are canonical game titles; values are 2D / 3D / Hybrid
DIMENSION_LOOKUP = {
    # Final Fantasy series
    "Final Fantasy": "2D",
    "Final Fantasy I": "2D",
    "Final Fantasy II": "2D",
    "Final Fantasy III": "2D",
    "Final Fantasy IV": "2D",
    "Final Fantasy V": "2D",
    "Final Fantasy VI": "2D",
    "Final Fantasy VII": "3D",
    "Final Fantasy VIII": "3D",
    "Final Fantasy IX": "3D",
    "Final Fantasy X": "3D",
    "Final Fantasy X-2": "3D",
    "Final Fantasy XI": "3D",
    "Final Fantasy XII": "3D",
    "Final Fantasy XIII": "3D",
    "Final Fantasy XIV": "3D",
    "Final Fantasy XV": "3D",
    "Final Fantasy XVI": "3D",
    "Final Fantasy VII Remake": "3D",
    "Final Fantasy VII Rebirth": "3D",
    "Final Fantasy Tactics": "Hybrid",
    "Final Fantasy Tactics Advance": "Hybrid",
    "Final Fantasy Tactics A2": "Hybrid",
    "Final Fantasy Adventure": "2D",
    "Final Fantasy Crystal Chronicles": "3D",
    "Final Fantasy Mystic Quest": "2D",
    # Dragon Quest / Dragon Warrior series
    "Dragon Warrior": "2D",
    "Dragon Quest": "2D",
    "Dragon Quest II": "2D",
    "Dragon Warrior II": "2D",
    "Dragon Quest III": "2D",
    "Dragon Warrior III": "2D",
    "Dragon Quest IV": "2D",
    "Dragon Warrior IV": "2D",
    "Dragon Quest V": "2D",
    "Dragon Quest VI": "2D",
    "Dragon Quest VII": "3D",
    "Dragon Quest VIII": "3D",
    "Dragon Quest IX": "3D",
    "Dragon Quest X": "3D",
    "Dragon Quest XI": "3D",
    "Dragon Quest Builders": "3D",
    "Dragon Quest Builders 2": "3D",
    # Mana series
    "Final Fantasy Adventure": "2D",
    "Secret of Mana": "2D",
    "Seiken Densetsu 3": "2D",
    "Trials of Mana": "2D",
    "Legend of Mana": "2D",
    "Children of Mana": "3D",
    "Dawn of Mana": "3D",
    # Chrono series
    "Chrono Trigger": "2D",
    "Chrono Cross": "3D",
    # Tactics / Strategy
    "Vagrant Story": "3D",
    "Front Mission": "2D",
    "Front Mission 3": "2D",
    "Tactics Ogre": "2D",
    # Action / Other
    "Kingdom Hearts": "3D",
    "Kingdom Hearts II": "3D",
    "Kingdom Hearts Chain of Memories": "2D",
    "Kingdom Hearts 358/2 Days": "3D",
    "Kingdom Hearts Birth by Sleep": "3D",
    "Kingdom Hearts Dream Drop Distance": "3D",
    "Kingdom Hearts III": "3D",
    "Xenogears": "Hybrid",
    "Parasite Eve": "3D",
    "Parasite Eve II": "3D",
    "Brave Fencer Musashi": "3D",
    "Bushido Blade": "3D",
    "Bushido Blade 2": "3D",
    "Tobal No. 1": "3D",
    "Tobal 2": "3D",
    "Ehrgeiz": "3D",
    "Star Ocean": "2D",
    "Star Ocean: The Second Story": "2D",
    "Star Ocean: Till the End of Time": "3D",
    "Star Ocean: The Last Hope": "3D",
    "Star Ocean: Integrity and Faithlessness": "3D",
    "Star Ocean: The Divine Force": "3D",
    "Valkyrie Profile": "2D",
    "Valkyrie Profile 2: Silmeria": "3D",
    "Valkyrie Profile: Covenant of the Plume": "2D",
    "Valkyrie Elysium": "3D",
    "Nier": "3D",
    "Nier: Automata": "3D",
    "Nier Replicant": "3D",
    "Deus Ex": "3D",
    "Deus Ex: Human Revolution": "3D",
    "Deus Ex: Mankind Divided": "3D",
    "Tomb Raider": "3D",
    "Rise of the Tomb Raider": "3D",
    "Shadow of the Tomb Raider": "3D",
    "Hitman": "3D",
    "Just Cause": "3D",
    "Just Cause 2": "3D",
    "Just Cause 3": "3D",
    "Just Cause 4": "3D",
    "Sleeping Dogs": "3D",
    "Thief": "3D",
    "Outriders": "3D",
    "Marvel's Avengers": "3D",
    "Forspoken": "3D",
    "Octopath Traveler": "Hybrid",
    "Octopath Traveler II": "Hybrid",
    "Triangle Strategy": "Hybrid",
    "Live A Live": "2D",
    "The DioField Chronicle": "3D",
    "Stranger of Paradise: Final Fantasy Origin": "3D",
    "Crisis Core: Final Fantasy VII": "3D",
    "Dissidia Final Fantasy": "3D",
}

# Titles known to be Japan-only (supplement to derived logic)
JAPAN_ONLY_TITLES = {
    "Front Mission",
    "Bahamut Lagoon",
    "Live A Live",
    "Rudora no Hiho",
    "Treasure of the Rudras",
    "Hanjuku Hero",
    "Hanjuku Hero 4",
    "Tobal 2",
    "Parasite Eve II",  # got limited NA release but primarily JP
    "Chocobo's Dungeon 2",
    "Vagrant Story",  # did release in NA, remove if needed
    "Romancing SaGa",
    "Romancing SaGa 2",
    "Romancing SaGa 3",
    "SaGa Frontier 2",
}

# Publisher string patterns that indicate a Square/Enix title
SQUARE_PUBLISHER_PATTERNS = [
    "square", "squaresoft", "enix", "square enix", "square-enix",
    "squaresoft co", "square co",
]


def get_company_era(publisher: str, year: int) -> str:
    pub = str(publisher).lower().strip()
    if "square enix" in pub or "square-enix" in pub:
        return "Square Enix"
    if "squaresoft" in pub:
        return "Squaresoft" if year <= 2003 else "Square Enix"
    if "square" in pub and "enix" not in pub:
        return "Squaresoft" if year <= 2003 else "Square Enix"
    if "enix" in pub:
        return "Enix" if year <= 2003 else "Square Enix"
    return "Unknown"


def get_nintendo_relationship_era(year: int, platform_family: str) -> str:
    if platform_family != "Nintendo":
        return "N/A"
    if year <= 1996:
        return "Pre-Split"
    if 1997 <= year <= 2001:
        return "Cold War"
    if year == 2002:
        return "Reconciliation"
    return "Post-Merger"
