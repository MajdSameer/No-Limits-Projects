/**
 * Client-safe option lists for booking forms. Suburb list powers a
 * <datalist> autocomplete — type-ahead with free text still allowed.
 * Lead sources/statuses mirror the company's sheet taxonomy.
 */

export const AU_STATES = ["NSW", "VIC", "QLD", "ACT", "SA", "WA", "TAS", "NT"] as const;

export const LEAD_SOURCES = [
  "Muval",
  "OneFlare",
  "Find a Mover",
  "Moving Select",
  "High Pages",
  "Bark",
  "Moving 24",
  "Rem. Compare",
  "Rem. Auction",
  "Tri Global",
  "Social Media",
  "Returning customer",
  "Word of Mouth",
  "Friend/Family recommendation",
  "Post / Mail",
  "Organic",
  "Other",
] as const;

export const STATUS_OPTIONS = [
  ["booked", "Booked"],
  ["deposit", "Deposit paid"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["refunded", "Refunded"],
] as const;

export const SUBURBS = [
  // Sydney metro
  "Alexandria NSW", "Ashfield NSW", "Auburn NSW", "Bankstown NSW", "Baulkham Hills NSW",
  "Blacktown NSW", "Bondi NSW", "Bondi Junction NSW", "Box Hill NSW", "Brighton-Le-Sands NSW",
  "Brookvale NSW", "Burwood NSW", "Cabramatta NSW", "Camden NSW", "Campbelltown NSW",
  "Castle Hill NSW", "Chatswood NSW", "Coogee NSW", "Cronulla NSW", "Darlinghurst NSW",
  "Dee Why NSW", "Engadine NSW", "Epping NSW", "Fairfield NSW", "Frenchs Forest NSW",
  "Granville NSW", "Greystanes NSW", "Hornsby NSW", "Hurstville NSW", "Ingleburn NSW",
  "Katoomba NSW", "Kellyville NSW", "Kensington NSW", "Kogarah NSW", "Lakemba NSW",
  "Lansvale NSW", "Leppington NSW", "Liverpool NSW", "Manly NSW", "Maroubra NSW",
  "Marrickville NSW", "Marsden Park NSW", "Mascot NSW", "Merrylands NSW", "Minto NSW",
  "Miranda NSW", "Mosman NSW", "Neutral Bay NSW", "Newtown NSW", "North Manly NSW",
  "North Sydney NSW", "Oran Park NSW", "Paddington NSW", "Parramatta NSW", "Penrith NSW",
  "Punchbowl NSW", "Randwick NSW", "Richmond NSW", "Rockdale NSW", "Rouse Hill NSW",
  "Ryde NSW", "Schofields NSW", "Strathfield NSW", "Surry Hills NSW", "Sutherland NSW",
  "Windsor NSW", "Zetland NSW",
  // NSW regional
  "Albury NSW", "Bathurst NSW", "Bowral NSW", "Byron Bay NSW", "Central Coast NSW",
  "Coffs Harbour NSW", "Dubbo NSW", "Gosford NSW", "Goulburn NSW", "Griffith NSW",
  "Lennox Head NSW", "Newcastle NSW", "Nowra NSW", "Orange NSW", "Port Macquarie NSW",
  "Shellharbour NSW", "Tamworth NSW", "Tweed Heads NSW", "Wagga Wagga NSW", "Wollongong NSW",
  "Wyong NSW",
  // Interstate corridors (the shareload base network)
  "Canberra ACT", "Melbourne VIC", "Geelong VIC", "Brisbane QLD", "Gold Coast QLD",
  "Sunshine Coast QLD", "Ipswich QLD", "Toowoomba QLD", "Hervey Bay QLD", "Bundaberg QLD",
  "Gladstone QLD", "Yeppoon QLD", "Rockhampton QLD", "Mackay QLD", "Townsville QLD",
  "Cairns QLD", "Adelaide SA", "Perth WA", "Hobart TAS", "Launceston TAS", "Darwin NT",
] as const;
