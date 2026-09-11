import React, { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  CalendarDays,
  X,
  Clock,
} from 'lucide-react'

export interface FestivalEvent {
  date: string // YYYY-MM-DD
  name: string
  category: 'National' | 'Hindu' | 'Muslim' | 'Christian' | 'Sikh' | 'Jain' | 'Buddhist' | 'Observance'
  description: string
  emoji?: string
}

// Indian Festivals & Cultural Celebrations Database (2025, 2026, 2027 + General Recurring)
const FESTIVALS_DATABASE: FestivalEvent[] = [
  // ── 2025 FESTIVALS & CELEBRATIONS ──
  { date: '2025-01-01', name: "New Year's Day", category: 'Observance', description: 'Celebration of the first day of the Gregorian new year.', emoji: '🎉' },
  { date: '2025-01-13', name: 'Lohri / Bhogi', category: 'Hindu', description: 'Harvest festival celebrated in Northern & Southern India.', emoji: '🔥' },
  { date: '2025-01-14', name: 'Makar Sankranti / Pongal', category: 'Hindu', description: 'Auspicious harvest festival marking the transition of the Sun into Capricorn.', emoji: '🪁' },
  { date: '2025-01-26', name: 'Republic Day', category: 'National', description: 'Honours the date on which the Constitution of India came into effect.', emoji: '🇮🇳' },
  { date: '2025-02-02', name: 'Vasant Panchami', category: 'Hindu', description: 'Festival dedicated to Goddess Saraswati, welcoming the spring season.', emoji: '🌼' },
  { date: '2025-02-26', name: 'Maha Shivratri', category: 'Hindu', description: 'Celebration of Lord Shiva with prayers and solemn devotion.', emoji: '🔱' },
  { date: '2025-03-14', name: 'Holi', category: 'Hindu', description: 'The vibrant festival of colors, spring arrival, and unity.', emoji: '🎨' },
  { date: '2025-03-30', name: 'Ugadi / Gudi Padwa', category: 'Hindu', description: 'Traditional New Year day for Telugu, Kannada, and Marathi communities.', emoji: '🌿' },
  { date: '2025-03-31', name: 'Eid-ul-Fitr', category: 'Muslim', description: 'Islamic festival marking the culmination of Ramadan holy fasting.', emoji: '🌙' },
  { date: '2025-04-06', name: 'Ram Navami', category: 'Hindu', description: 'Celebration of the birth anniversary of Lord Rama.', emoji: '🏹' },
  { date: '2025-04-10', name: 'Mahavir Jayanti', category: 'Jain', description: 'Celebration of Bhagwan Mahavira, the twenty-fourth Tirthankara.', emoji: '🪷' },
  { date: '2025-04-14', name: 'Dr. B.R. Ambedkar Jayanti / Baisakhi', category: 'National', description: 'Commemorates the architect of the Indian Constitution, Dr. B.R. Ambedkar.', emoji: '⚖️' },
  { date: '2025-04-18', name: 'Good Friday', category: 'Christian', description: 'Christian observance commemorating the crucifixion of Jesus.', emoji: '✝️' },
  { date: '2025-05-01', name: 'May Day / Labour Day', category: 'Observance', description: 'International Workers Day honoring the labour movement and workers.', emoji: '⚒️' },
  { date: '2025-05-12', name: 'Buddha Purnima', category: 'Buddhist', description: 'Celebration of the birth, enlightenment, and death of Gautama Buddha.', emoji: '☸️' },
  { date: '2025-06-07', name: 'Bakrid / Eid-ul-Adha', category: 'Muslim', description: 'Feast of the Sacrifice, honoring obedience and charitable giving.', emoji: '🐑' },
  { date: '2025-07-06', name: 'Muharram (Ashura)', category: 'Muslim', description: 'First month of Islamic calendar; marks the day of Ashura.', emoji: '🕊️' },
  { date: '2025-08-09', name: 'Raksha Bandhan', category: 'Hindu', description: 'Festival celebrating the bond of protection and love between siblings.', emoji: '🧵' },
  { date: '2025-08-15', name: 'Independence Day', category: 'National', description: 'Commemorates Indias independence and unity.', emoji: '🇮🇳' },
  { date: '2025-08-16', name: 'Janmashtami', category: 'Hindu', description: 'Celebrates the birth of Lord Krishna with joy and devotion.', emoji: '🦚' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi', category: 'Hindu', description: 'Celebration welcoming Lord Ganesha with reverence and festivities.', emoji: '🐘' },
  { date: '2025-09-05', name: 'Milad-un-Nabi / Onam', category: 'Muslim', description: 'Mawlid celebrations & Keralas grand harvest festival Onam.', emoji: '🌸' },
  { date: '2025-10-02', name: 'Mahatma Gandhi Jayanti', category: 'National', description: 'Honors the birthday of the Father of the Nation, Mahatma Gandhi.', emoji: '🕊️' },
  { date: '2025-10-02', name: 'Dussehra / Vijayadashami', category: 'Hindu', description: 'Celebration of the victory of good over evil, Rama over Ravana.', emoji: '🏹' },
  { date: '2025-10-20', name: 'Diwali / Deepavali', category: 'Hindu', description: 'The glorious Festival of Lights celebrating righteousness and prosperity.', emoji: '🪔' },
  { date: '2025-10-22', name: 'Govardhan Puja', category: 'Hindu', description: 'Worship of Mount Govardhan and Lord Krishna.', emoji: '🌾' },
  { date: '2025-10-23', name: 'Bhai Dooj', category: 'Hindu', description: 'Celebration of brother-sister bond following Diwali.', emoji: '✨' },
  { date: '2025-10-28', name: 'Chhath Puja', category: 'Hindu', description: 'Ancient Vedic festival dedicated to Surya and Shashthi Devi.', emoji: '☀️' },
  { date: '2025-11-05', name: 'Guru Nanak Jayanti', category: 'Sikh', description: 'Celebrates the birth of the first Sikh Guru, Guru Nanak Dev Ji.', emoji: 'ੴ' },
  { date: '2025-12-25', name: 'Christmas Day', category: 'Christian', description: 'Celebration of the birth of Jesus Christ.', emoji: '🎄' },

  // ── 2026 FESTIVALS & CELEBRATIONS (Current Year) ──
  { date: '2026-01-01', name: "New Year's Day", category: 'Observance', description: 'Celebration of the first day of the Gregorian calendar year 2026.', emoji: '🎉' },
  { date: '2026-01-13', name: 'Bhogi Festival', category: 'Hindu', description: 'First day of the 4-day Pongal / Makar Sankranti festival.', emoji: '🔥' },
  { date: '2026-01-14', name: 'Makar Sankranti / Pongal', category: 'Hindu', description: 'Major harvest festival observed across Telangana, AP, Tamil Nadu, and India.', emoji: '🪁' },
  { date: '2026-01-15', name: 'Kanuma Panduga', category: 'Hindu', description: 'Celebration honoring domestic cattle and farm harvest.', emoji: '🌾' },
  { date: '2026-01-23', name: 'Netaji Subhash Bose Jayanti', category: 'National', description: 'Parakram Diwas honoring the patriotism of Netaji Subhas Chandra Bose.', emoji: '🎖️' },
  { date: '2026-01-26', name: 'Republic Day', category: 'National', description: 'Celebration of the Indian Constitution and sovereignty.', emoji: '🇮🇳' },
  { date: '2026-02-15', name: 'Maha Shivratri', category: 'Hindu', description: 'Festival worshiping Lord Shiva with prayers and meditation.', emoji: '🔱' },
  { date: '2026-03-02', name: 'Holika Dahan', category: 'Hindu', description: 'Bonfire ritual celebrating the victory of devotion and faith.', emoji: '🔥' },
  { date: '2026-03-03', name: 'Holi / Dol Jatra', category: 'Hindu', description: 'Vibrant festival of colours celebrated joyously with family and friends.', emoji: '🎨' },
  { date: '2026-03-19', name: 'Ugadi / Gudi Padwa', category: 'Hindu', description: 'New Year for Telugu, Kannada, and Marathi communities.', emoji: '🌿' },
  { date: '2026-03-20', name: 'Eid-ul-Fitr (Ramzan)', category: 'Muslim', description: 'Islamic feast of breaking the month-long dawn-to-sunset Ramadan fast.', emoji: '🌙' },
  { date: '2026-03-27', name: 'Sri Rama Navami', category: 'Hindu', description: 'Celebrates the descent of the god Vishnu as the Rama avatar.', emoji: '🏹' },
  { date: '2026-03-31', name: 'Mahavir Jayanti', category: 'Jain', description: 'Birth anniversary of Bhagwan Mahavira, the twenty-fourth Tirthankara.', emoji: '🪷' },
  { date: '2026-04-03', name: 'Good Friday', category: 'Christian', description: 'Christian observance commemorating the passion and crucifixion of Jesus.', emoji: '✝️' },
  { date: '2026-04-05', name: 'Easter Sunday', category: 'Christian', description: 'Celebrating the resurrection of Jesus Christ.', emoji: '🐣' },
  { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti / Tamil New Year', category: 'National', description: 'Tribute to Dr. B.R. Ambedkar & regional New Year festivities.', emoji: '⚖️' },
  { date: '2026-05-01', name: 'May Day / Labour Day', category: 'Observance', description: 'Recognizing workers dedication, hard work, and contributions.', emoji: '⚒️' },
  { date: '2026-05-01', name: 'Buddha Purnima', category: 'Buddhist', description: 'Honors the birth, enlightenment, and nirvana of Gautama Buddha.', emoji: '☸️' },
  { date: '2026-05-27', name: 'Bakrid / Eid-ul-Adha', category: 'Muslim', description: 'The Festival of the Sacrifice celebrated with charity and prayers.', emoji: '🐑' },
  { date: '2026-06-26', name: 'Muharram (Day of Ashura)', category: 'Muslim', description: 'Tenth day of Muharram, solemn observance.', emoji: '🕊️' },
  { date: '2026-08-15', name: 'Independence Day', category: 'National', description: 'Indias 80th Independence Day celebration of freedom and unity.', emoji: '🇮🇳' },
  { date: '2026-08-15', name: 'Parsi New Year (Navroz)', category: 'Observance', description: 'Celebration of the traditional Zoroastrian New Year.', emoji: '🌸' },
  { date: '2026-08-26', name: 'Milad-un-Nabi / Onam', category: 'Muslim', description: 'Prophets birthday & Grand Keralite Thiruvonam harvest celebrations.', emoji: '🌼' },
  { date: '2026-08-28', name: 'Raksha Bandhan', category: 'Hindu', description: 'Auspicious festival celebrating the affection between brothers and sisters.', emoji: '🧵' },
  { date: '2026-09-04', name: 'Sri Krishna Janmashtami', category: 'Hindu', description: 'Celebration of Lord Krishnas auspicious birth at midnight.', emoji: '🦚' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi / Vinayaka Chavithi', category: 'Hindu', description: 'Public festivities welcoming Lord Ganesha.', emoji: '🐘' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', category: 'National', description: 'In honor of Mahatma Gandhis philosophy of truth and non-violence.', emoji: '🕊️' },
  { date: '2026-10-18', name: 'Maha Saptami / Durga Puja', category: 'Hindu', description: 'Invoking Goddess Durga during the joyous Navratri festival.', emoji: '🌺' },
  { date: '2026-10-19', name: 'Maha Ashtami / Ayudha Puja', category: 'Hindu', description: 'Worship of instruments, equipment, vehicles, and tools of trade.', emoji: '⚔️' },
  { date: '2026-10-20', name: 'Dussehra / Vijayadashami', category: 'Hindu', description: 'Vijayadashami marking triumph over darkness and auspicious new beginnings.', emoji: '🏹' },
  { date: '2026-10-29', name: 'Karwa Chauth', category: 'Hindu', description: 'Celebration observed by married women for family well-being.', emoji: '🌕' },
  { date: '2026-11-06', name: 'Dhanteras', category: 'Hindu', description: 'Worship of Lord Dhanvantari and welcoming health and prosperity.', emoji: '🪙' },
  { date: '2026-11-07', name: 'Naraka Chaturdashi / Deepavali Eve', category: 'Hindu', description: 'Choti Diwali celebrating victory of light over darkness.', emoji: '✨' },
  { date: '2026-11-08', name: 'Diwali / Deepavali', category: 'Hindu', description: 'The Grand Festival of Lights, fireworks, sweets, and Lakshmi Puja.', emoji: '🪔' },
  { date: '2026-11-09', name: 'Govardhan Puja', category: 'Hindu', description: 'Day honoring nature, ecology, and Lord Krishna.', emoji: '🌾' },
  { date: '2026-11-10', name: 'Bhai Dooj', category: 'Hindu', description: 'Ceremony of sibling affection and blessings.', emoji: '✨' },
  { date: '2026-11-15', name: 'Chhath Puja', category: 'Hindu', description: 'Arghya offered to Surya Dev on river banks.', emoji: '☀️' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', category: 'Sikh', description: 'Parkash Utsav of Guru Nanak Dev Ji with kirtan and langar.', emoji: 'ੴ' },
  { date: '2026-12-24', name: 'Christmas Eve', category: 'Christian', description: 'Evening preceding Christmas celebrations and festive gatherings.', emoji: '⭐' },
  { date: '2026-12-25', name: 'Christmas Day', category: 'Christian', description: 'Joyful celebration of Christs Nativity with family and peace.', emoji: '🎄' },
  { date: '2026-12-31', name: "New Year's Eve", category: 'Observance', description: 'Gatherings and welcoming the forthcoming year.', emoji: '🎆' },

  // ── 2027 FESTIVALS & CELEBRATIONS ──
  { date: '2027-01-01', name: "New Year's Day", category: 'Observance', description: 'Welcome to the year 2027!', emoji: '🎉' },
  { date: '2027-01-14', name: 'Makar Sankranti / Pongal', category: 'Hindu', description: 'Sun enters Makara rashi, celebrated with sesame sweets and festive kites.', emoji: '🪁' },
  { date: '2027-01-26', name: 'Republic Day', category: 'National', description: 'Indias Republic Day celebration of democracy.', emoji: '🇮🇳' },
  { date: '2027-03-06', name: 'Maha Shivratri', category: 'Hindu', description: 'Celebration in praise of Lord Shiva.', emoji: '🔱' },
  { date: '2027-03-10', name: 'Eid-ul-Fitr', category: 'Muslim', description: 'Celebration marking the conclusion of holy Ramadan.', emoji: '🌙' },
  { date: '2027-03-22', name: 'Holi', category: 'Hindu', description: 'Springtime festival of colors.', emoji: '🎨' },
  { date: '2027-03-26', name: 'Good Friday', category: 'Christian', description: 'Christian solemn observance.', emoji: '✝️' },
  { date: '2027-04-07', name: 'Ugadi / Gudi Padwa', category: 'Hindu', description: 'Traditional lunar new year.', emoji: '🌿' },
  { date: '2027-04-14', name: 'Dr. B.R. Ambedkar Jayanti', category: 'National', description: 'Tribute to Dr. B.R. Ambedkar.', emoji: '⚖️' },
  { date: '2027-05-01', name: 'May Day', category: 'Observance', description: 'International workers appreciation day.', emoji: '⚒️' },
  { date: '2027-05-16', name: 'Bakrid / Eid-ul-Adha', category: 'Muslim', description: 'Islamic feast of sacrifice.', emoji: '🐑' },
  { date: '2027-08-15', name: 'Independence Day', category: 'National', description: 'Indias Independence Day.', emoji: '🇮🇳' },
  { date: '2027-08-25', name: 'Krishna Janmashtami', category: 'Hindu', description: 'Celebration of Lord Krishna.', emoji: '🦚' },
  { date: '2027-09-04', name: 'Ganesh Chaturthi', category: 'Hindu', description: 'Festival of Lord Ganesha.', emoji: '🐘' },
  { date: '2027-10-02', name: 'Mahatma Gandhi Jayanti', category: 'National', description: 'Birth anniversary of Mahatma Gandhi.', emoji: '🕊️' },
  { date: '2027-10-09', name: 'Dussehra', category: 'Hindu', description: 'Vijayadashami celebration.', emoji: '🏹' },
  { date: '2027-10-29', name: 'Diwali / Deepavali', category: 'Hindu', description: 'Grand festival of lights.', emoji: '🪔' },
  { date: '2027-11-14', name: 'Guru Nanak Jayanti', category: 'Sikh', description: 'Birth of Guru Nanak Dev Ji.', emoji: 'ੴ' },
  { date: '2027-12-25', name: 'Christmas Day', category: 'Christian', description: 'Christmas celebration.', emoji: '🎄' },
]

// Constant recurring events for any year not explicitly listed
const RECURRING_ANNUAL_FESTIVALS: Omit<FestivalEvent, 'date'>[] = [
  { name: "New Year's Day", category: 'Observance', description: 'First day of the new year.', emoji: '🎉' },
  { name: 'Makar Sankranti / Pongal', category: 'Hindu', description: 'Harvest festival.', emoji: '🪁' },
  { name: 'Republic Day', category: 'National', description: 'Indias Republic Day celebration.', emoji: '🇮🇳' },
  { name: 'Dr. B.R. Ambedkar Jayanti', category: 'National', description: 'Commemorates Dr. B.R. Ambedkar.', emoji: '⚖️' },
  { name: 'Labour Day', category: 'Observance', description: 'International Workers Day.', emoji: '⚒️' },
  { name: 'Independence Day', category: 'National', description: 'Indias Independence Day.', emoji: '🇮🇳' },
  { name: 'Mahatma Gandhi Jayanti', category: 'National', description: 'Birthday of Mahatma Gandhi.', emoji: '🕊️' },
  { name: 'Christmas Day', category: 'Christian', description: 'Celebration of Christmas.', emoji: '🎄' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface TeamsCalendarViewProps {
  onBackToChat?: () => void
}

export const TeamsCalendarView: React.FC<TeamsCalendarViewProps> = ({ onBackToChat }) => {
  const today = useMemo(() => new Date(), [])
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()) // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Modal popup state for clicked festival date
  const [modalData, setModalData] = useState<{
    dateStr: string
    formattedDate: string
    events: FestivalEvent[]
  } | null>(null)

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalData(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fast dictionary lookup map by date string: 'YYYY-MM-DD' -> FestivalEvent[]
  const festivalsByDate = useMemo(() => {
    const map = new Map<string, FestivalEvent[]>()

    // Add all database events
    FESTIVALS_DATABASE.forEach((evt) => {
      const existing = map.get(evt.date) || []
      existing.push(evt)
      map.set(evt.date, existing)
    })

    // Fallback for years without dynamic coverage
    const knownYears = new Set([2025, 2026, 2027])
    if (!knownYears.has(currentYear)) {
      const fixedDates = [
        { mmdd: '01-01', ...RECURRING_ANNUAL_FESTIVALS[0] },
        { mmdd: '01-14', ...RECURRING_ANNUAL_FESTIVALS[1] },
        { mmdd: '01-26', ...RECURRING_ANNUAL_FESTIVALS[2] },
        { mmdd: '04-14', ...RECURRING_ANNUAL_FESTIVALS[3] },
        { mmdd: '05-01', ...RECURRING_ANNUAL_FESTIVALS[4] },
        { mmdd: '08-15', ...RECURRING_ANNUAL_FESTIVALS[5] },
        { mmdd: '10-02', ...RECURRING_ANNUAL_FESTIVALS[6] },
        { mmdd: '12-25', ...RECURRING_ANNUAL_FESTIVALS[7] },
      ]
      fixedDates.forEach((h) => {
        const fullDate = `${currentYear}-${h.mmdd}`
        if (!map.has(fullDate)) {
          map.set(fullDate, [{ date: fullDate, ...h }])
        }
      })
    }

    return map
  }, [currentYear])

  // Helper date formatter
  const formatFullDate = (dStr: string) => {
    if (!dStr) return ''
    const [y, m, d] = dStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  // Month grid calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay() // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate()

    const cells: {
      dayNumber: number
      isCurrentMonth: boolean
      dateStr: string
      isToday: boolean
      isWeekend: boolean
      events: FestivalEvent[]
    }[] = []

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      cells.push({
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateStr,
        isToday: false,
        isWeekend: false,
        events: festivalsByDate.get(dateStr) || [],
      })
    }

    // Current month days
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      const dayOfWeek = new Date(currentYear, currentMonth, dayNum).getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isToday = dateStr === todayStr
      cells.push({
        dayNumber: dayNum,
        isCurrentMonth: true,
        dateStr,
        isToday,
        isWeekend,
        events: festivalsByDate.get(dateStr) || [],
      })
    }

    // Next month filler days (fill up to 35 or 42 grid slots)
    const remainingSlots = (7 - (cells.length % 7)) % 7
    for (let i = 1; i <= remainingSlots; i++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      cells.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateStr,
        isToday: false,
        isWeekend: false,
        events: festivalsByDate.get(dateStr) || [],
      })
    }

    return cells
  }, [currentYear, currentMonth, today, festivalsByDate])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setSelectedDateStr(todayStr)
    const todayEvents = festivalsByDate.get(todayStr) || []
    if (todayEvents.length > 0) {
      setModalData({
        dateStr: todayStr,
        formattedDate: formatFullDate(todayStr),
        events: todayEvents,
      })
    }
  }

  // Selected date events
  const selectedDateEvents = useMemo(() => {
    return festivalsByDate.get(selectedDateStr) || []
  }, [selectedDateStr, festivalsByDate])

  const selectedFormattedDate = useMemo(() => {
    return formatFullDate(selectedDateStr)
  }, [selectedDateStr])

  // All festivals in the currently viewed month
  const monthFestivals = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    const list: FestivalEvent[] = []
    festivalsByDate.forEach((events, date) => {
      if (date.startsWith(monthPrefix)) {
        events.forEach((e) => list.push(e))
      }
    })
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [currentYear, currentMonth, festivalsByDate])

  // Filtered festivals for search/list
  const filteredMonthFestivals = useMemo(() => {
    return monthFestivals.filter((fest) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        fest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fest.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fest.category.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        filterCategory === 'all' || fest.category.toLowerCase() === filterCategory.toLowerCase()

      return matchesSearch && matchesCategory
    })
  }, [monthFestivals, searchQuery, filterCategory])

  // Handler when user clicks on a cell
  const handleCellClick = (cell: { dateStr: string; events: FestivalEvent[] }) => {
    setSelectedDateStr(cell.dateStr)
    if (cell.events.length > 0) {
      setModalData({
        dateStr: cell.dateStr,
        formattedDate: formatFullDate(cell.dateStr),
        events: cell.events,
      })
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#F8F9FA',
      overflowY: 'auto',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      position: 'relative',
    }}>
      {/* ── TOP HEADER ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1rem',
        background: '#FFFFFF',
        borderBottom: '1px solid #E1DFDD',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 4px rgba(91, 95, 199, 0.25)',
            }}>
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#242424', lineHeight: 1.2 }}>
                Calendar & Festivals
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#616161' }}>
                Festivals & Cultural Events
              </span>
            </div>
          </div>

        {/* Month Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleJumpToToday}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #5B5FC7',
              background: 'rgba(91, 95, 199, 0.08)',
              color: '#5B5FC7',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* ── CALENDAR TOOLBAR & MONTH NAVIGATION ── */}
      <div style={{
        background: '#FFFFFF',
        margin: '0.75rem 1rem 0.5rem 1rem',
        borderRadius: '12px',
        border: '1px solid #EDEBE9',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      }}>
        {/* Month & Year Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: '1px solid #E1DFDD',
              background: '#FFFFFF',
              color: '#424242',
              cursor: 'pointer',
            }}
            title="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            style={{
              padding: '0.38rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #E1DFDD',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#242424',
              cursor: 'pointer',
            }}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(Number(e.target.value))}
            style={{
              padding: '0.38rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #E1DFDD',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#242424',
              cursor: 'pointer',
            }}
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNextMonth}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: '1px solid #E1DFDD',
              background: '#FFFFFF',
              color: '#424242',
              cursor: 'pointer',
            }}
            title="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── MAIN CALENDAR GRID & DETAILS CONTAINER ── */}
      <div style={{
        padding: '0 1rem 1.5rem 1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
      }}>
        {/* ── LEFT: 7-DAY CALENDAR GRID CARD ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EDEBE9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Weekday Header Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: '#F8F8FA',
            borderBottom: '1px solid #EDEBE9',
            textAlign: 'center',
          }}>
            {WEEKDAY_NAMES.map((w, idx) => {
              const isSunday = idx === 0
              return (
                <div
                  key={w}
                  style={{
                    padding: '0.65rem 0.2rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: isSunday ? '#C4314B' : '#616161',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {w}
                </div>
              )
            })}
          </div>

          {/* Day Grid Cells */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            flex: 1,
          }}>
            {calendarGrid.map((cell, idx) => {
              const isSelected = cell.dateStr === selectedDateStr
              const hasEvents = cell.events.length > 0
              const primaryEvent = hasEvents ? cell.events[0] : null

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => handleCellClick(cell)}
                  style={{
                    minHeight: '74px',
                    padding: '0.35rem 0.25rem',
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #F3F2F1',
                    borderBottom: '1px solid #F3F2F1',
                    background: isSelected
                      ? 'rgba(91, 95, 199, 0.08)'
                      : cell.isCurrentMonth
                      ? (cell.isWeekend ? '#FCFCFC' : '#FFFFFF')
                      : '#FAFAFA',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                    outline: isSelected ? '2px solid #5B5FC7' : 'none',
                    outlineOffset: '-2px',
                    opacity: cell.isCurrentMonth ? 1 : 0.42,
                  }}
                  title={hasEvents ? `${primaryEvent?.name} (Click for details)` : undefined}
                >
                  {/* Day Number Circle */}
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: cell.isToday || isSelected ? 700 : (cell.isCurrentMonth ? 500 : 400),
                    background: cell.isToday
                      ? '#5B5FC7'
                      : isSelected
                      ? '#EEF1FA'
                      : 'transparent',
                    color: cell.isToday
                      ? '#FFFFFF'
                      : isSelected
                      ? '#5B5FC7'
                      : (cell.isWeekend && cell.isCurrentMonth ? '#C4314B' : '#242424'),
                    boxShadow: cell.isToday ? '0 1px 3px rgba(91, 95, 199, 0.4)' : 'none',
                    marginBottom: '0.2rem',
                  }}>
                    {cell.dayNumber}
                  </div>

                  {/* Festival Mini Indicator Pill */}
                  {hasEvents && cell.isCurrentMonth && (
                    <div style={{
                      width: '100%',
                      padding: '0.14rem 0.25rem',
                      borderRadius: '4px',
                      background: '#EEF1FA',
                      border: '1px solid #D0D4F5',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 'auto',
                      marginBottom: '0.15rem',
                    }}>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: '#444791',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {primaryEvent?.emoji ? `${primaryEvent.emoji} ` : '✨ '}
                        {primaryEvent?.name}
                      </span>
                    </div>
                  )}

                  {/* Dot for extra events */}
                  {cell.events.length > 1 && cell.isCurrentMonth && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '3px',
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      color: '#5B5FC7',
                    }}>
                      +{cell.events.length - 1}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Calendar Legend Bar */}
          <div style={{
            padding: '0.65rem 1rem',
            background: '#FAFAFA',
            borderTop: '1px solid #EDEBE9',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1.25rem',
            fontSize: '0.74rem',
            color: '#616161',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#5B5FC7' }} />
              <span>Today</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                background: '#EEF1FA',
                border: '1px solid #D0D4F5',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#444791',
              }}>
                ✨ Festival
              </div>
              <span>Click to view details</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: SELECTED DATE CARD & FESTIVALS AND EVENTS LIST ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Selected Date Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EDEBE9',
            padding: '1.1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5B5FC7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Selected Date
              </span>
              <span style={{ fontSize: '0.75rem', color: '#8A8886' }}>
                {selectedDateStr}
              </span>
            </div>

            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#242424' }}>
              {selectedFormattedDate}
            </h3>

            {selectedDateEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {selectedDateEvents.map((evt, i) => (
                  <div
                    key={i}
                    onClick={() => setModalData({
                      dateStr: selectedDateStr,
                      formattedDate: selectedFormattedDate,
                      events: selectedDateEvents,
                    })}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: '#EEF1FA',
                      border: '1px solid #D0D4F5',
                      cursor: 'pointer',
                      transition: 'transform 0.1s ease',
                    }}
                    title="Click for full popup details"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {evt.emoji && <span style={{ fontSize: '1.15rem' }}>{evt.emoji}</span>}
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#242424' }}>
                          {evt.name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        color: '#5B5FC7',
                        border: '1px solid #D0D4F5',
                      }}>
                        {evt.category}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#424242', lineHeight: 1.4 }}>
                      {evt.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '0.85rem',
                borderRadius: '8px',
                background: '#F8F9FA',
                border: '1px solid #EDEBE9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}>
                <CheckCircle2 size={20} color="#237B4B" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#242424' }}>
                    Regular Working Day
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#616161' }}>
                    Scheduled shifts proceed as assigned.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Festivals and Events in [Month] [Year] List */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EDEBE9',
            padding: '1.1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Sparkles size={16} color="#5B5FC7" />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#242424' }}>
                  Festivals and Events in {MONTH_NAMES[currentMonth]} {currentYear}
                </h4>
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #E1DFDD',
                  fontSize: '0.72rem',
                  color: '#424242',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Traditions</option>
                <option value="Hindu">Hindu</option>
                <option value="Muslim">Muslim</option>
                <option value="Christian">Christian</option>
                <option value="Sikh">Sikh</option>
                <option value="National">National</option>
                <option value="Observance">Observance</option>
              </select>
            </div>

            {/* Quick Search */}
            <div style={{
              position: 'relative',
              marginBottom: '0.75rem',
            }}>
              <Search
                size={14}
                color="#8A8886"
                style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search festival or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  border: '1px solid #E1DFDD',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* List of festivals */}
            <div style={{
              overflowY: 'auto',
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              {filteredMonthFestivals.length > 0 ? (
                filteredMonthFestivals.map((fest, idx) => {
                  const [y, m, d] = fest.date.split('-').map(Number)
                  const dt = new Date(y, m - 1, d)
                  const dayOfWeek = dt.toLocaleDateString('en-IN', { weekday: 'short' })
                  const isSelected = fest.date === selectedDateStr

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDateStr(fest.date)
                        const allEvents = festivalsByDate.get(fest.date) || [fest]
                        setModalData({
                          dateStr: fest.date,
                          formattedDate: formatFullDate(fest.date),
                          events: allEvents,
                        })
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #5B5FC7' : '1px solid #EDEBE9',
                        background: isSelected ? 'rgba(91, 95, 199, 0.06)' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      title="Click to view full details"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {/* Date badge */}
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '8px',
                          background: '#EEF1FA',
                          border: '1px solid #D0D4F5',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#444791', lineHeight: 1 }}>
                            {d}
                          </span>
                          <span style={{ fontSize: '0.58rem', fontWeight: 600, color: '#444791', textTransform: 'uppercase' }}>
                            {dayOfWeek}
                          </span>
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {fest.emoji && <span>{fest.emoji}</span>}
                            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#242424' }}>
                              {fest.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#616161' }}>
                            {fest.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#8A8886',
                  fontSize: '0.82rem',
                }}>
                  No festivals match your search for {MONTH_NAMES[currentMonth]}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── POPUP MODAL FOR FESTIVAL DETAILS ── */}
      {modalData && (
        <div
          onClick={() => setModalData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              animation: 'popIn 0.18s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
              padding: '1rem 1.25rem',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} />
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Festival Details</span>
              </div>
              <button
                type="button"
                onClick={() => setModalData(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.25rem' }}>
              {/* Formatted Date */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#5B5FC7',
                marginBottom: '1rem',
                background: 'rgba(91, 95, 199, 0.08)',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                width: 'fit-content',
              }}>
                <CalendarDays size={14} />
                <span>{modalData.formattedDate}</span>
              </div>

              {/* Event list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {modalData.events.map((evt, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#F9F9FB',
                      border: '1px solid #E1DFDD',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {evt.emoji && <span style={{ fontSize: '1.3rem' }}>{evt.emoji}</span>}
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#242424' }}>
                          {evt.name}
                        </h4>
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#5B5FC7',
                        background: '#EEF1FA',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                      }}>
                        {evt.category}
                      </span>
                    </div>

                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#424242', lineHeight: 1.45 }}>
                      {evt.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Shift info note */}
              <div style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem',
                padding: '0.6rem 0.8rem',
                background: '#F3F4FB',
                border: '1px solid #E3E5F8',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#444791',
                lineHeight: 1.35,
              }}>
                <Clock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Shift schedule reminder: Clinical shifts and patient care duties proceed according to assigned rosters.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.75rem 1.25rem 1rem 1.25rem',
              background: '#F8F9FA',
              borderTop: '1px solid #EDEBE9',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setModalData(null)}
                style={{
                  padding: '0.45rem 1.2rem',
                  borderRadius: '6px',
                  background: '#5B5FC7',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(91, 95, 199, 0.3)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
