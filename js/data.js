/* Object catalog: real J2000 orbital elements, physical data and facts.
   Display sizes/orbits are compressed for viewing — heliocentric distances are
   to scale (1 AU = 60 units), body radii use a sqrt scale so everything is visible. */
const DATA = (function () {
  const AU = 60;
  function dispR(km) { return Math.max(0.0075 * Math.sqrt(km), 0.055); }

  /* elements: a (AU), e, i/O/wbar (deg), L (mean longitude at J2000, deg), P (days)
     comets use w (arg of perihelion) + Tp (perihelion JD) instead of wbar/L */
  const bodies = [
    {
      id: 'sun', name: 'Sun', kind: 'star', color: 0xffd27d,
      radiusKm: 696340, dispRad: 6.5, rotH: 609.12, tilt: 7.25,
      rows: [
        ['Type', 'G2V yellow dwarf star'],
        ['Diameter', '1,391,400 km (109 × Earth)'],
        ['Mass', '1.989 × 10³⁰ kg — 99.86% of the Solar System'],
        ['Surface temp', '5,505 °C (core: ~15,000,000 °C)'],
        ['Rotation', '~25 days at equator, ~35 at poles'],
        ['Age', '~4.6 billion years'],
        ['Composition', '~73% hydrogen, 25% helium']
      ],
      blurb: 'The star at the center of it all. The Sun fuses about 600 million tonnes of hydrogen into helium every second, and the energy released powers nearly all life and weather on Earth.',
      fun: [
        'About 1.3 million Earths would fit inside the Sun.',
        'Sunlight takes 8 minutes 20 seconds to reach Earth — but the energy itself took ~100,000 years to escape the core.',
        'Every second, 4 million tonnes of the Sun’s mass is converted into pure energy.',
        'In about 5 billion years it will swell into a red giant, likely swallowing Mercury and Venus.'
      ]
    },
    {
      id: 'mercury', name: 'Mercury', kind: 'planet', color: 0x9c9a92,
      radiusKm: 2439.7, rotH: 1407.5, tilt: 0.03,
      elements: { a: 0.38709893, e: 0.20563069, i: 7.00487, O: 48.33167, wbar: 77.45645, L: 252.25084, P: 87.969 },
      rows: [
        ['Diameter', '4,879 km'],
        ['Mass', '3.30 × 10²³ kg (0.055 × Earth)'],
        ['Gravity', '3.7 m/s²'],
        ['Day (solar)', '176 Earth days'],
        ['Year', '88 Earth days'],
        ['Distance from Sun', '57.9 million km (0.39 AU)'],
        ['Temperature', '−173 °C to +427 °C'],
        ['Moons', '0']
      ],
      blurb: 'The smallest planet and the closest to the Sun — a cratered, airless world of brutal temperature swings, where a single solar day lasts two of its years.',
      fun: [
        'A solar day on Mercury (sunrise to sunrise) lasts 176 Earth days — twice as long as its year.',
        'Despite being closest to the Sun, it is not the hottest planet (Venus is).',
        'There is water ice hiding in permanently shadowed polar craters.',
        'The whole planet has shrunk by ~7 km in radius as its iron core cooled.'
      ]
    },
    {
      id: 'venus', name: 'Venus', kind: 'planet', color: 0xe8c468,
      radiusKm: 6051.8, rotH: -5832.4, tilt: 177.4, atmo: { color: 0xe8cf9a, size: 1.045, power: 3.2, intensity: 0.55 },
      elements: { a: 0.72333199, e: 0.00677323, i: 3.39471, O: 76.68069, wbar: 131.53298, L: 181.97973, P: 224.701 },
      rows: [
        ['Diameter', '12,104 km'],
        ['Mass', '4.87 × 10²⁴ kg (0.815 × Earth)'],
        ['Gravity', '8.87 m/s²'],
        ['Day (sidereal)', '243 Earth days — retrograde'],
        ['Year', '224.7 Earth days'],
        ['Distance from Sun', '108.2 million km (0.72 AU)'],
        ['Temperature', '464 °C average — hottest planet'],
        ['Pressure', '92 × Earth (like 900 m underwater)'],
        ['Moons', '0']
      ],
      blurb: 'Earth’s toxic twin: similar in size, but wrapped in a crushing CO₂ atmosphere with clouds of sulfuric acid and a runaway greenhouse effect that melts lead at the surface.',
      fun: [
        'Venus spins backwards — the Sun rises in the west and sets in the east.',
        'Its day (243 Earth days) is longer than its year (225 Earth days).',
        'Soviet Venera landers survived at most ~2 hours on the surface before being destroyed.',
        'It is the brightest natural object in our night sky after the Moon.'
      ]
    },
    {
      id: 'earth', name: 'Earth', kind: 'planet', color: 0x5d8cff,
      radiusKm: 6371, rotH: 23.934, tilt: 23.44, special: 'earth',
      atmo: { color: 0x5d9aff, size: 1.05, power: 3.4, intensity: 0.85 },
      elements: { a: 1.00000011, e: 0.01671022, i: 0.00005, O: -11.26064, wbar: 102.94719, L: 100.46435, P: 365.256 },
      rows: [
        ['Diameter', '12,742 km'],
        ['Mass', '5.97 × 10²⁴ kg'],
        ['Gravity', '9.81 m/s²'],
        ['Day', '23.93 hours'],
        ['Year', '365.25 days'],
        ['Distance from Sun', '149.6 million km (1 AU)'],
        ['Temperature', '15 °C average'],
        ['Moons', '1 (plus ~10,000 artificial satellites)']
      ],
      blurb: 'Home. The only place in the universe where life is known to exist — 71% covered by liquid water, shielded by a magnetic field and a thin blue atmosphere.',
      fun: [
        'Earth is the densest planet in the Solar System.',
        'Its rotation is slowing: days get ~1.8 ms longer per century as the Moon drifts away.',
        'The planet is not a perfect sphere — it bulges at the equator by 43 km.',
        'Look for the city lights on the night side, and the ISS circling overhead!'
      ]
    },
    {
      id: 'luna', name: 'Moon', kind: 'moon', parent: 'earth', color: 0xaab4c4,
      radiusKm: 1737.4, sync: true,
      orbit: { periodD: 27.3217, distF: 3.6, incl: 5.1, inTilt: false },
      rows: [
        ['Diameter', '3,474 km'],
        ['Distance from Earth', '384,400 km (and drifting away)'],
        ['Orbital period', '27.3 days'],
        ['Gravity', '1.62 m/s² (1/6 of Earth)'],
        ['Temperature', '−173 °C to +127 °C'],
        ['Age', '~4.5 billion years']
      ],
      blurb: 'Earth’s constant companion, probably born when a Mars-sized world struck the young Earth. It is tidally locked, always showing us the same face, and its gravity drives our ocean tides.',
      fun: [
        'Only 12 humans have walked on it, all between 1969 and 1972.',
        'It moves away from Earth by about 3.8 cm every year.',
        'Astronaut footprints will survive for millions of years — there is no wind to erase them.',
        'It is the fifth-largest moon in the Solar System.'
      ]
    },
    {
      id: 'mars', name: 'Mars', kind: 'planet', color: 0xff7a52,
      radiusKm: 3389.5, rotH: 24.623, tilt: 25.19,
      atmo: { color: 0xd9967a, size: 1.04, power: 3.8, intensity: 0.25 },
      elements: { a: 1.52366231, e: 0.09341233, i: 1.85061, O: 49.57854, wbar: 336.04084, L: 355.45332, P: 686.98 },
      rows: [
        ['Diameter', '6,779 km'],
        ['Mass', '6.42 × 10²³ kg (0.107 × Earth)'],
        ['Gravity', '3.71 m/s²'],
        ['Day', '24.6 hours'],
        ['Year', '687 Earth days'],
        ['Distance from Sun', '227.9 million km (1.52 AU)'],
        ['Temperature', '−63 °C average'],
        ['Moons', '2 (Phobos & Deimos)']
      ],
      blurb: 'The Red Planet — a cold desert world that once had rivers, lakes and possibly seas. Today rovers crawl its surface searching for traces of ancient life.',
      fun: [
        'Olympus Mons is the tallest volcano in the Solar System: 21.9 km — 2.5 × Mount Everest.',
        'Valles Marineris is a canyon system as long as the USA is wide (~4,000 km).',
        'Sunsets on Mars are blue.',
        'Its red color is literally rust — iron oxide dust covering everything.'
      ]
    },
    {
      id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', color: 0xb09a88,
      radiusKm: 11.27, sync: true, lumpy: true,
      orbit: { periodD: 0.3189, distF: 2.4, incl: 1.1 },
      rows: [
        ['Size', '27 × 22 × 18 km (potato-shaped)'],
        ['Distance from Mars', '9,376 km — closest moon to any planet'],
        ['Orbital period', '7 h 39 min'],
        ['Discovered', '1877, Asaph Hall']
      ],
      blurb: 'A lumpy, cratered moonlet that races around Mars faster than the planet spins — from the surface it rises in the west and crosses the sky twice a day.',
      fun: [
        'It spirals 1.8 m closer to Mars every century — in ~50 million years it will crash or be shredded into a ring.',
        'Gravity is so weak you could throw a baseball into orbit.',
        'Its giant Stickney crater is nearly half the moon’s own width.'
      ]
    },
    {
      id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', color: 0xc2ad9a,
      radiusKm: 6.2, sync: true, lumpy: true,
      orbit: { periodD: 1.2624, distF: 3.6, incl: 1.8 },
      rows: [
        ['Size', '15 × 12 × 11 km'],
        ['Distance from Mars', '23,460 km'],
        ['Orbital period', '30.3 hours'],
        ['Discovered', '1877, Asaph Hall']
      ],
      blurb: 'The smaller and outer of Mars’ two moons — a smooth, dust-blanketed rock that from the Martian surface looks like little more than a bright star.',
      fun: [
        'Named after the Greek god of dread, twin brother of Phobos (fear).',
        'It is slowly drifting away from Mars, like our own Moon from Earth.',
        'Both Martian moons may be captured asteroids — or debris from a giant impact.'
      ]
    },
    {
      id: 'jupiter', name: 'Jupiter', kind: 'planet', color: 0xd9a066,
      radiusKm: 69911, rotH: 9.925, tilt: 3.13,
      atmo: { color: 0xd9b48a, size: 1.035, power: 3.6, intensity: 0.3 },
      elements: { a: 5.20336301, e: 0.04839266, i: 1.3053, O: 100.55615, wbar: 14.75385, L: 34.40438, P: 4332.589 },
      rows: [
        ['Diameter', '139,820 km (11 × Earth)'],
        ['Mass', '1.90 × 10²⁷ kg — 2.5 × all other planets combined'],
        ['Gravity', '24.79 m/s²'],
        ['Day', '9.9 hours — fastest spinner'],
        ['Year', '11.86 Earth years'],
        ['Distance from Sun', '778.5 million km (5.2 AU)'],
        ['Temperature', '−145 °C at cloud tops'],
        ['Moons', '95 confirmed']
      ],
      blurb: 'The king of planets — a gas giant so massive it nudges the entire Solar System. Its Great Red Spot is a storm wider than Earth that has raged for at least 350 years.',
      fun: [
        'Jupiter has no solid surface — descend and gas just thickens into a sea of metallic hydrogen.',
        'Its magnetic field is ~20,000 × stronger than Earth’s.',
        'It would need ~80 × more mass to ignite as a star.',
        'The four big moons you can see here were discovered by Galileo in 1610 — proof that not everything orbits Earth.'
      ]
    },
    {
      id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', color: 0xe8d06a,
      radiusKm: 1821.6, sync: true, plumes: { type: 'volcano' },
      orbit: { periodD: 1.7691, distF: 2.6, incl: 0.05 },
      rows: [
        ['Diameter', '3,643 km'],
        ['Distance from Jupiter', '421,700 km'],
        ['Orbital period', '1.77 days'],
        ['Volcanoes', '400+ active'],
        ['Discovered', '1610, Galileo']
      ],
      blurb: 'The most volcanically active world in the Solar System. Jupiter’s tides knead Io’s interior like dough, powering hundreds of erupting volcanoes that paint it in sulfur yellows and reds.',
      fun: [
        'Eruption plumes shoot up to 500 km into space.',
        'Its surface is constantly repaved — almost no impact craters survive.',
        'Astronomers call it the "pizza moon" for obvious reasons.'
      ]
    },
    {
      id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', color: 0xd8cdb8,
      radiusKm: 1560.8, sync: true,
      orbit: { periodD: 3.5512, distF: 3.4, incl: 0.47 },
      rows: [
        ['Diameter', '3,122 km'],
        ['Distance from Jupiter', '670,900 km'],
        ['Orbital period', '3.55 days'],
        ['Surface', 'Water ice, −160 °C'],
        ['Ocean depth', '~60–150 km (under the ice)']
      ],
      blurb: 'A smooth ice ball hiding a global liquid-water ocean with more water than all of Earth’s seas combined — one of the most promising places to look for alien life.',
      fun: [
        'The reddish-brown cracks ("linea") are seams where the ice shell flexes and salty water wells up.',
        'NASA’s Europa Clipper spacecraft is on its way, arriving in 2030.',
        'Its ice shell may be only a few kilometres thick in places.'
      ]
    },
    {
      id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', color: 0xb0a08a,
      radiusKm: 2634.1, sync: true,
      orbit: { periodD: 7.1546, distF: 4.4, incl: 0.2 },
      rows: [
        ['Diameter', '5,268 km — largest moon in the Solar System'],
        ['Distance from Jupiter', '1,070,400 km'],
        ['Orbital period', '7.15 days'],
        ['Discovered', '1610, Galileo']
      ],
      blurb: 'The largest moon anywhere — bigger than the planet Mercury. It is the only moon known to generate its own magnetic field, and it too hides a salty subsurface ocean.',
      fun: [
        'If it orbited the Sun instead of Jupiter, it would count as a planet.',
        'ESA’s JUICE spacecraft will enter orbit around Ganymede in 2034.',
        'Its dark regions are ~4 billion years old; the bright grooved ones are younger ice.'
      ]
    },
    {
      id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', color: 0x8a7a66,
      radiusKm: 2410.3, sync: true,
      orbit: { periodD: 16.689, distF: 6.0, incl: 0.2 },
      rows: [
        ['Diameter', '4,821 km'],
        ['Distance from Jupiter', '1,882,700 km'],
        ['Orbital period', '16.69 days'],
        ['Discovered', '1610, Galileo']
      ],
      blurb: 'The most heavily cratered object in the Solar System — a 4-billion-year-old surface that has barely changed since the planets formed.',
      fun: [
        'It orbits outside Jupiter’s deadly radiation belts, making it the favored site for a future crewed base.',
        'The Valhalla impact basin spans about 3,800 km of concentric rings.',
        'It is almost exactly the same size as Mercury, but only a third the mass.'
      ]
    },
    {
      id: 'saturn', name: 'Saturn', kind: 'planet', color: 0xe7cf8e,
      radiusKm: 58232, rotH: 10.656, tilt: 26.73, rings: 'saturn',
      atmo: { color: 0xe8d8a8, size: 1.035, power: 3.6, intensity: 0.25 },
      elements: { a: 9.53707032, e: 0.0541506, i: 2.48446, O: 113.71504, wbar: 92.43194, L: 49.94432, P: 10759.22 },
      rows: [
        ['Diameter', '116,460 km (without rings)'],
        ['Ring span', '~282,000 km wide, often just ~10 m thick'],
        ['Mass', '5.68 × 10²⁶ kg (95 × Earth)'],
        ['Gravity', '10.44 m/s²'],
        ['Day', '10.7 hours'],
        ['Year', '29.4 Earth years'],
        ['Distance from Sun', '1.43 billion km (9.5 AU)'],
        ['Temperature', '−178 °C'],
        ['Moons', '274 — the most of any planet']
      ],
      blurb: 'The jewel of the Solar System. Its dazzling rings are billions of chunks of nearly pure water ice, from dust grains to house-sized boulders, each on its own orbit.',
      fun: [
        'Saturn is less dense than water — it would float in a big enough bathtub.',
        'The rings may be only 10–100 million years old: dinosaurs may have seen a ringless Saturn.',
        'A bizarre hexagonal jet stream swirls around its north pole.',
        'Winds reach 1,800 km/h — among the fastest in the Solar System.'
      ]
    },
    {
      id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', color: 0xe8f4ff,
      radiusKm: 252.1, sync: true, plumes: { type: 'geyser' },
      orbit: { periodD: 1.3702, distF: 2.7, incl: 0.02 },
      rows: [
        ['Diameter', '504 km'],
        ['Distance from Saturn', '237,950 km'],
        ['Orbital period', '1.37 days'],
        ['Surface', 'Freshest, whitest ice in the Solar System']
      ],
      blurb: 'A tiny moon with a big secret: geysers at its south pole blast water from a buried ocean straight into space, feeding one of Saturn’s rings.',
      fun: [
        'Cassini flew through the plumes and tasted salt, organics and hydrogen — possible food for microbes.',
        'It is the most reflective body in the Solar System, bouncing back ~90% of sunlight.',
        'The "tiger stripe" fractures at its south pole are warmer than everything around them.'
      ]
    },
    {
      id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', color: 0xcfcac2,
      radiusKm: 763.8, sync: true,
      orbit: { periodD: 4.5182, distF: 3.5, incl: 0.35 },
      rows: [
        ['Diameter', '1,528 km'],
        ['Distance from Saturn', '527,100 km'],
        ['Orbital period', '4.52 days'],
        ['Discovered', '1672, Giovanni Cassini']
      ],
      blurb: 'Saturn’s second-largest moon — a cold, ancient ball of ice and rock, saturated with craters.',
      fun: [
        'It has a wisp of an atmosphere: oxygen and carbon dioxide, a trillion times thinner than Earth’s.',
        'It may once have had its own faint ring — which would have made it the first ringed moon ever found.'
      ]
    },
    {
      id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', color: 0xe0a83c,
      radiusKm: 2574.7, sync: true,
      atmo: { color: 0xe8a83c, size: 1.09, power: 2.6, intensity: 0.7 },
      orbit: { periodD: 15.9454, distF: 4.9, incl: 0.33 },
      rows: [
        ['Diameter', '5,150 km — 2nd largest moon'],
        ['Distance from Saturn', '1,221,900 km'],
        ['Orbital period', '15.9 days'],
        ['Atmosphere', '1.5 × Earth pressure, mostly nitrogen'],
        ['Temperature', '−179 °C']
      ],
      blurb: 'The only moon with a thick atmosphere, and the only world besides Earth with liquid on its surface — rivers, rain and seas of liquid methane under an orange smog.',
      fun: [
        'ESA’s Huygens probe landed here in 2005 — still the most distant landing ever made.',
        'NASA’s Dragonfly drone will fly through its skies in the 2030s.',
        'In Titan’s low gravity and dense air, a human could fly by flapping strap-on wings.'
      ]
    },
    {
      id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', color: 0xb8a890,
      radiusKm: 734.5, sync: true,
      orbit: { periodD: 79.3215, distF: 7.6, incl: 15.5 },
      rows: [
        ['Diameter', '1,469 km'],
        ['Distance from Saturn', '3,560,800 km'],
        ['Orbital period', '79.3 days'],
        ['Discovered', '1671, Giovanni Cassini']
      ],
      blurb: 'The yin-yang moon: one hemisphere is dark as coal, the other bright as snow. A mysterious ridge of 13-km peaks runs exactly along its equator, giving it a walnut shape.',
      fun: [
        'The dark side sweeps up dust shed by the distant moon Phoebe.',
        'Cassini discovered it in 1671 and could only see it on one side of Saturn — the dark face hid it on the other.'
      ]
    },
    {
      id: 'uranus', name: 'Uranus', kind: 'planet', color: 0x7fd4d4,
      radiusKm: 25362, rotH: -17.24, tilt: 97.77, rings: 'uranus',
      atmo: { color: 0x9adede, size: 1.04, power: 3.4, intensity: 0.3 },
      elements: { a: 19.19126393, e: 0.04716771, i: 0.76986, O: 74.22988, wbar: 170.96424, L: 313.23218, P: 30688.5 },
      rows: [
        ['Diameter', '50,724 km (4 × Earth)'],
        ['Mass', '8.68 × 10²⁵ kg'],
        ['Gravity', '8.87 m/s²'],
        ['Day', '17.2 hours (retrograde)'],
        ['Year', '84 Earth years'],
        ['Distance from Sun', '2.87 billion km (19.2 AU)'],
        ['Temperature', '−224 °C — coldest atmosphere'],
        ['Moons', '28, named after Shakespeare characters']
      ],
      blurb: 'The sideways planet: knocked over by an ancient collision, Uranus rolls around the Sun on its side, so each pole gets 42 years of daylight followed by 42 years of night.',
      fun: [
        'Notice its rings and moons orbit vertically here — the whole system tipped over with it.',
        'Its clouds contain hydrogen sulfide: the planet literally smells of rotten eggs.',
        'Only one spacecraft has ever visited: Voyager 2, in 1986.',
        'It was the first planet discovered with a telescope (William Herschel, 1781).'
      ]
    },
    {
      id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', color: 0xb8b4ae,
      radiusKm: 235.8, sync: true,
      orbit: { periodD: 1.4135, distF: 2.5, incl: 4.2 },
      rows: [
        ['Diameter', '472 km'],
        ['Distance from Uranus', '129,400 km'],
        ['Orbital period', '1.41 days'],
        ['Discovered', '1948, Gerard Kuiper']
      ],
      blurb: 'A bizarre patchwork world that looks bolted together from mismatched parts — it may have been shattered by an impact and clumsily reassembled.',
      fun: [
        'Verona Rupes, its great cliff, is up to 20 km tall — the highest known cliff in the Solar System.',
        'In Miranda’s feeble gravity, a jump off that cliff would mean falling for several minutes.'
      ]
    },
    {
      id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', color: 0xc2b0a0,
      radiusKm: 788.4, sync: true,
      orbit: { periodD: 8.7062, distF: 3.8, incl: 0.08 },
      rows: [
        ['Diameter', '1,577 km — largest moon of Uranus'],
        ['Distance from Uranus', '435,900 km'],
        ['Orbital period', '8.71 days'],
        ['Discovered', '1787, William Herschel']
      ],
      blurb: 'Uranus’ biggest moon, named for the queen of the fairies in A Midsummer Night’s Dream — an icy world slashed by enormous canyons.',
      fun: [
        'Its Messina Chasma canyon stretches ~1,500 km.',
        'Uranian moons are named for Shakespeare and Alexander Pope characters instead of mythology.'
      ]
    },
    {
      id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', color: 0xa89888,
      radiusKm: 761.4, sync: true,
      orbit: { periodD: 13.4632, distF: 4.8, incl: 0.07 },
      rows: [
        ['Diameter', '1,523 km'],
        ['Distance from Uranus', '583,500 km'],
        ['Orbital period', '13.46 days'],
        ['Discovered', '1787, William Herschel']
      ],
      blurb: 'The outermost large moon of Uranus — old, dark and densely cratered, with mysterious dark material pooled on some crater floors.',
      fun: [
        'A mountain on its limb photographed by Voyager 2 rises about 11 km.',
        'Named for the fairy king in A Midsummer Night’s Dream.'
      ]
    },
    {
      id: 'neptune', name: 'Neptune', kind: 'planet', color: 0x5a7bff,
      radiusKm: 24622, rotH: 16.11, tilt: 28.32,
      atmo: { color: 0x6a8aff, size: 1.04, power: 3.4, intensity: 0.4 },
      elements: { a: 30.06896348, e: 0.00858587, i: 1.76917, O: 131.72169, wbar: 44.97135, L: 304.88003, P: 60182 },
      rows: [
        ['Diameter', '49,244 km'],
        ['Mass', '1.02 × 10²⁶ kg (17 × Earth)'],
        ['Gravity', '11.15 m/s²'],
        ['Day', '16.1 hours'],
        ['Year', '164.8 Earth years'],
        ['Distance from Sun', '4.5 billion km (30 AU)'],
        ['Temperature', '−214 °C'],
        ['Moons', '16'],
        ['Winds', 'Up to 2,100 km/h — fastest anywhere']
      ],
      blurb: 'The windiest world: supersonic storms tear through its deep-blue methane atmosphere. Neptune was found with mathematics before telescopes — its gravity was tugging Uranus off course.',
      fun: [
        'It completed its first full orbit since discovery (1846) only in 2011.',
        'Inside, it may rain diamonds.',
        'Voyager 2 is the only spacecraft to have visited, in 1989.',
        'Its largest moon Triton orbits backwards — a captured Kuiper Belt world.'
      ]
    },
    {
      id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', color: 0xe0cdbd,
      radiusKm: 1353.4, sync: true, retro: true,
      orbit: { periodD: 5.8769, distF: 3.5, incl: 23 },
      rows: [
        ['Diameter', '2,707 km'],
        ['Distance from Neptune', '354,760 km'],
        ['Orbital period', '5.88 days — backwards!'],
        ['Temperature', '−235 °C — coldest surface measured'],
        ['Discovered', '1846, 17 days after Neptune itself']
      ],
      blurb: 'Neptune’s big moon orbits the wrong way — proof it didn’t form here but was captured, a kidnapped sibling of Pluto. Nitrogen geysers erupt through its pink ice.',
      fun: [
        'Its retrograde orbit is slowly decaying: in ~3.6 billion years Neptune will tear it apart into a spectacular ring.',
        'Its surface is so cold that nitrogen freezes solid.',
        'The strange dimpled "cantaloupe terrain" exists nowhere else.'
      ]
    },
    {
      id: 'pluto', name: 'Pluto', kind: 'dwarf', color: 0xc2a98f,
      radiusKm: 1188.3, rotH: -153.29, tilt: 122.5,
      elements: { a: 39.48168677, e: 0.24880766, i: 17.14175, O: 110.30347, wbar: 224.06676, L: 238.92881, P: 90560 },
      rows: [
        ['Diameter', '2,377 km — smaller than our Moon'],
        ['Mass', '1.31 × 10²² kg (0.002 × Earth)'],
        ['Gravity', '0.62 m/s²'],
        ['Day', '6.4 Earth days (retrograde)'],
        ['Year', '248 Earth years'],
        ['Distance from Sun', '5.9 billion km avg (39.5 AU)'],
        ['Temperature', '−229 °C'],
        ['Moons', '5 (Charon, Styx, Nix, Kerberos, Hydra)']
      ],
      blurb: 'The most famous dwarf planet, demoted in 2006 but still beloved. New Horizons revealed a stunning world with a vast nitrogen-ice heart, water-ice mountains and blue skies.',
      fun: [
        'Its orbit is so eccentric that from 1979 to 1999 it was closer to the Sun than Neptune.',
        'Pluto and Charon orbit a point in empty space between them — a true double world.',
        'It was named by 11-year-old Venetia Burney in 1930.',
        'A year on Pluto lasts 248 Earth years: it hasn’t completed one orbit since its discovery.'
      ]
    },
    {
      id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', color: 0xa8a4a0,
      radiusKm: 606, sync: true,
      orbit: { periodD: 6.3872, distF: 3.4, incl: 0.08 },
      rows: [
        ['Diameter', '1,212 km — half of Pluto'],
        ['Distance from Pluto', '19,590 km'],
        ['Orbital period', '6.39 days'],
        ['Discovered', '1978, James Christy']
      ],
      blurb: 'Half the size of its parent — the largest moon relative to its planet anywhere. Pluto and Charon are mutually locked, eternally facing each other like dance partners.',
      fun: [
        'Its dark-red north pole ("Mordor Macula") is stained by gases escaping from Pluto.',
        'From Pluto’s near side, Charon hangs motionless in the sky, never rising or setting.'
      ]
    },
    {
      id: 'ceres', name: 'Ceres', kind: 'dwarf', color: 0xb0a59a,
      radiusKm: 469.7, rotH: 9.07, tilt: 4,
      elements: { a: 2.7691, e: 0.076, i: 10.594, O: 80.305, wbar: 153.9, L: 162.2, P: 1683.15 },
      rows: [
        ['Diameter', '940 km — largest asteroid-belt object'],
        ['Mass', '~1/3 of the entire asteroid belt'],
        ['Day', '9 hours'],
        ['Year', '4.6 Earth years'],
        ['Distance from Sun', '2.77 AU'],
        ['Discovered', '1801, Giuseppe Piazzi']
      ],
      blurb: 'The only dwarf planet of the inner Solar System, ruling the asteroid belt. NASA’s Dawn orbiter found salty bright spots — residue of briny water seeping from below.',
      fun: [
        'When discovered in 1801 it was hailed as a new planet for half a century.',
        'The dazzling spots in Occator crater are sodium carbonate — leftovers of an underground brine.',
        'It may still hide pockets of liquid salty water today.'
      ]
    },
    {
      id: 'eris', name: 'Eris', kind: 'dwarf', color: 0xcfd4e0,
      radiusKm: 1163, rotH: 25.9, tilt: 78,
      elements: { a: 67.86, e: 0.4361, i: 44.04, O: 35.95, w: 151.64, Tp: 2545600, P: 204199 },
      rows: [
        ['Diameter', '2,326 km — nearly Pluto-sized, but heavier'],
        ['Year', '559 Earth years'],
        ['Distance from Sun', '38–98 AU (currently near aphelion)'],
        ['Moons', '1 (Dysnomia)'],
        ['Discovered', '2005, Mike Brown’s team']
      ],
      blurb: 'The troublemaker: finding this Pluto-sized world in 2005 forced astronomers to define "planet" — and Pluto lost. Fittingly, Eris is the goddess of discord.',
      fun: [
        'It is 27% more massive than Pluto despite being almost the same size.',
        'It is so far away that the Sun would look like just a very bright star.',
        'Its frozen methane atmosphere may thaw into gas when it swings closer to the Sun.'
      ]
    },
    {
      id: 'haumea', name: 'Haumea', kind: 'dwarf', color: 0xe6ebf0,
      radiusKm: 780, rotH: 3.92, tilt: 0,
      elements: { a: 43.13, e: 0.195, i: 28.21, O: 121.9, wbar: 0.9, L: 219.1, P: 103774 },
      rows: [
        ['Shape', 'Elongated, ~2,100 × 1,160 km'],
        ['Day', 'just 3.9 hours — one of the fastest big spinners'],
        ['Year', '284 Earth years'],
        ['Distance from Sun', '~43 AU'],
        ['Moons', '2 (Hiʻiaka, Namaka)'],
        ['Discovered', '2004']
      ],
      blurb: 'A dwarf planet spun into a rugby-ball shape by its blistering 4-hour rotation. Haumea even has a thin ring — the first ever found around a body beyond Neptune.',
      fun: [
        'It spins so fast it is stretched almost twice as long as it is wide.',
        'It is the only known dwarf planet with a ring system.',
        'A giant collision likely created its two moons and an icy family of fragments.'
      ]
    },
    {
      id: 'makemake', name: 'Makemake', kind: 'dwarf', color: 0xd9a98a,
      radiusKm: 715, rotH: 22.83, tilt: 0,
      elements: { a: 45.43, e: 0.159, i: 28.98, O: 79.62, wbar: 16.2, L: 169.9, P: 111845 },
      rows: [
        ['Diameter', '~1,430 km'],
        ['Year', '305 Earth years'],
        ['Distance from Sun', '~45 AU'],
        ['Surface', 'Frozen methane and ethane'],
        ['Discovered', '2005 — nicknamed "Easterbunny"']
      ],
      blurb: 'A reddish, methane-frosted dwarf planet of the Kuiper Belt, one of the discoveries that helped end Pluto’s run as the ninth planet.',
      fun: [
        'It is named after the creator god of the Rapa Nui people of Easter Island.',
        'It was found just after Easter 2005, hence its team nickname "Easterbunny".',
        'Despite its size it has almost no atmosphere, unlike Pluto.'
      ]
    },
    {
      id: 'halley', name: "Halley's Comet", kind: 'comet', color: 0x9fd8ff,
      radiusKm: 5.5, lumpy: true,
      elements: { a: 17.834, e: 0.96714, i: 162.26, O: 58.42, w: 111.33, Tp: 2446470.95, P: 27510 },
      rows: [
        ['Nucleus', '15 × 8 km, dark as charcoal'],
        ['Orbital period', '~76 years (retrograde)'],
        ['Last perihelion', 'February 1986'],
        ['Next perihelion', '28 July 2061'],
        ['Recorded since', '240 BC']
      ],
      blurb: 'The most famous comet in history, returning every ~76 years. Edmond Halley realized in 1705 that sightings across centuries were one object — and correctly predicted its return.',
      fun: [
        'It appears on the 1066 Bayeux Tapestry and inspired Giotto’s Star of Bethlehem.',
        'Mark Twain was born at its 1835 visit and died, as he predicted, at its 1910 return.',
        'Every year Earth crosses its debris trail — we see it as the Orionid meteor shower.',
        '⏩ Tip: speed up time to 2061 to watch it dive back toward the Sun and grow its tail!'
      ]
    },
    {
      id: 'c67p', name: '67P/Churyumov–Gerasimenko', kind: 'comet', color: 0x9fd8ff,
      radiusKm: 2.2, lumpy: true,
      elements: { a: 3.463, e: 0.6409, i: 7.04, O: 50.14, w: 12.78, Tp: 2459520.5, P: 2353 },
      rows: [
        ['Nucleus', '4.3 × 4.1 km, rubber-duck shaped'],
        ['Orbital period', '6.45 years'],
        ['Next perihelion', 'April 2028'],
        ['Visited by', 'ESA Rosetta, 2014–2016']
      ],
      blurb: 'The first comet ever orbited by a spacecraft. ESA’s Rosetta escorted it for two years, and its lander Philae made the first-ever comet touchdown — bouncing twice on the way.',
      fun: [
        'Its two-lobed "rubber duck" shape is two ancient comets gently fused together.',
        'Rosetta heard it "sing" — oscillations in its magnetic field.',
        'Comets like this are 4.6-billion-year-old leftovers from the Solar System’s construction.',
        '⏩ Tip: fast-forward to April 2028 to see it active near the Sun.'
      ]
    },
    {
      id: 'encke', name: "Comet Encke", kind: 'comet', color: 0x9fd8ff,
      radiusKm: 2.4, lumpy: true,
      elements: { a: 2.215, e: 0.848, i: 11.78, O: 334.57, w: 186.55, Tp: 2460239.5, P: 1204 },
      rows: [
        ['Nucleus', '~4.8 km'],
        ['Orbital period', '3.3 years — shortest of any bright comet'],
        ['Aphelion', 'only 4.1 AU (inside Jupiter)'],
        ['Discovered', '1786; orbit computed by Johann Encke 1819']
      ],
      blurb: 'The comet with the shortest known period of any major comet — it never strays beyond Jupiter, swinging past the Sun every 3.3 years.',
      fun: [
        'Debris from Encke causes the Taurid meteor showers every autumn.',
        'It was only the second comet (after Halley) recognized as periodic.',
        'After thousands of laps around the Sun, it has nearly run out of ice.'
      ]
    },
    {
      id: 'iss', name: 'International Space Station', kind: 'craft', parent: 'earth', color: 0xffd166,
      craft: 'iss',
      orbit: { periodD: 0.0645, distF: 1.45, incl: 51.6 },
      rows: [
        ['Size', '109 m × 73 m — a football field in space'],
        ['Mass', '~420 tonnes'],
        ['Altitude', '~400 km'],
        ['Speed', '27,600 km/h — one orbit every 90 min'],
        ['Crewed since', '2 November 2000, without a single day’s break'],
        ['Partners', 'NASA · Roscosmos · ESA · JAXA · CSA']
      ],
      blurb: 'Humanity’s outpost in orbit — the largest structure ever assembled in space, continuously inhabited for over 25 years by crews from 23 countries.',
      fun: [
        'Astronauts aboard see 16 sunrises and 16 sunsets every day.',
        'At ~$150 billion, it is the most expensive object ever built.',
        'You can see it with the naked eye — it outshines every star.',
        '⏱ Tip: set time speed to "Real time" or "1 min/s" to watch it gently circle Earth.'
      ]
    },
    {
      id: 'jwst', name: 'James Webb Space Telescope', kind: 'craft', parent: 'earth', color: 0xffd166,
      craft: 'jwst',
      rows: [
        ['Mirror', '6.5 m across — 18 gold-coated segments'],
        ['Sunshield', '21 × 14 m, five layers'],
        ['Location', 'Sun–Earth L2, 1.5 million km from Earth'],
        ['Operating temp', '−233 °C'],
        ['Launched', '25 December 2021']
      ],
      blurb: 'The most powerful space telescope ever built, parked beyond the Moon at the L2 point. It sees in infrared, peering at the first galaxies that formed after the Big Bang.',
      fun: [
        'Its mirrors are coated with just 48 grams of gold — about a golf ball’s worth.',
        'It can detect the heat of a bumblebee at the distance of the Moon.',
        'It always keeps its sunshield toward the Sun and Earth, so it can never photograph Earth.'
      ]
    },
    {
      id: 'voyager1', name: 'Voyager 1', kind: 'craft', color: 0xffd166,
      craft: 'probe', ray: { lon: 255.9, lat: 35.0, r0: 169.0, rate: 3.57, jd0: 2461200 },
      rows: [
        ['Launched', '5 September 1977'],
        ['Distance', '~169 AU — farthest human-made object'],
        ['Speed', '~61,000 km/h (3.57 AU/year)'],
        ['Signal delay', 'over 23 hours one-way'],
        ['Status', 'In interstellar space since August 2012'],
        ['Power', 'Plutonium RTG, fading ~4 W per year']
      ],
      blurb: 'The farthest object humanity has ever sent — nearly a light-day away and still whispering home at 160 bits per second after almost 50 years of flight.',
      fun: [
        'It carries the Golden Record: greetings in 55 languages, whale song, Bach and Chuck Berry.',
        'In 1990 it turned around and took the "Pale Blue Dot" photo of Earth from 6 billion km.',
        'In ~40,000 years it will drift within 1.6 light-years of the star Gliese 445.',
        'Its computers have ~240,000 × less memory than a modern phone.'
      ]
    },
    {
      id: 'voyager2', name: 'Voyager 2', kind: 'craft', color: 0xffd166,
      craft: 'probe', ray: { lon: 288.7, lat: -37.3, r0: 143.0, rate: 3.16, jd0: 2461200 },
      rows: [
        ['Launched', '20 August 1977 — 16 days before Voyager 1'],
        ['Distance', '~143 AU'],
        ['Speed', '~55,000 km/h (3.16 AU/year)'],
        ['Status', 'In interstellar space since November 2018'],
        ['Grand Tour', 'Jupiter 1979 · Saturn 1981 · Uranus 1986 · Neptune 1989']
      ],
      blurb: 'The only spacecraft ever to visit all four giant planets, riding a planetary alignment that occurs once every 176 years. It remains the sole visitor to Uranus and Neptune.',
      fun: [
        'It discovered 11 new moons of Uranus and Neptune’s Great Dark Spot.',
        'Like its twin, it carries a Golden Record for any finders.',
        'In ~296,000 years it will pass near Sirius, the brightest star in our sky.'
      ]
    },
    {
      id: 'newhorizons', name: 'New Horizons', kind: 'craft', color: 0xffd166,
      craft: 'probe', ray: { lon: 292, lat: 2.0, r0: 65.0, rate: 2.95, jd0: 2461200 },
      rows: [
        ['Launched', '19 January 2006 — fastest launch ever (58,500 km/h)'],
        ['Pluto flyby', '14 July 2015'],
        ['Arrokoth flyby', '1 January 2019 — farthest world ever explored'],
        ['Distance', '~65 AU and climbing'],
        ['Size', 'About a grand piano']
      ],
      blurb: 'The little probe that unveiled Pluto. After a 9.5-year sprint it returned breathtaking images of the dwarf planet’s heart, then flew on to the snowman-shaped Arrokoth in the Kuiper Belt.',
      fun: [
        'It passed the Moon’s orbit just 9 hours after launch.',
        'It carries some of the ashes of Clyde Tombaugh, Pluto’s discoverer.',
        'It will eventually leave the Solar System, the fifth craft ever to do so.'
      ]
    },
    {
      id: 'belt', name: 'Asteroid Belt', kind: 'region', color: 0x8a8478,
      view: { pos: [2.7, 0.18, 0.4], dist: 130 },
      rows: [
        ['Location', 'Between Mars and Jupiter (2.2–3.2 AU)'],
        ['Objects', 'Millions — over 1.4 million catalogued'],
        ['Total mass', 'Only ~4% of our Moon'],
        ['Largest member', 'Ceres (940 km)']
      ],
      blurb: 'A ring of rocky rubble that never managed to become a planet — Jupiter’s gravity kept stirring the pot. Despite the movies, it is mostly empty space.',
      fun: [
        'Asteroids here are on average ~1 million km apart — spacecraft fly through without dodging.',
        'They are leftovers from the Solar System’s construction, 4.6 billion years ago.',
        'Some near-Earth asteroids are worth quintillions in metals — at least on paper.'
      ]
    },
    {
      id: 'kuiper', name: 'Kuiper Belt', kind: 'region', color: 0x7a8ba8,
      view: { pos: [30, 6, 22], dist: 1500 },
      rows: [
        ['Location', '30–55 AU, beyond Neptune'],
        ['Objects', 'Likely 100,000+ larger than 100 km'],
        ['Famous residents', 'Pluto, Eris, Makemake, Haumea, Arrokoth'],
        ['Named after', 'Gerard Kuiper, 1951']
      ],
      blurb: 'A vast, cold donut of icy worlds beyond Neptune — fossils from the Solar System’s birth. Short-period comets fall sunward from here.',
      fun: [
        'It is ~20 × wider and far more massive than the asteroid belt.',
        'Far beyond it lies the hypothetical Oort Cloud, stretching halfway to the next star.',
        'Some astronomers suspect an undiscovered "Planet Nine" shepherds the belt’s strange orbits.'
      ]
    },
    {
      id: 'andromeda', name: 'Andromeda Galaxy', kind: 'galaxy', color: 0xcdd6ff,
      dispRad: 540, sky: { lon: 40, lat: 26, dist: 11000 },
      galaxy: { type: 'spiral', seed: 11, incl: 74, arms: 2, turns: 3.0, spin: 0.025,
        core: '255,236,200', arm: '150,190,255', hii: '255,150,190' },
      rows: [
        ['Designation', 'Messier 31 / NGC 224'],
        ['Type', 'Barred spiral (SA(s)b)'],
        ['Distance', '2.5 million light-years'],
        ['Diameter', '~152,000 light-years'],
        ['Stars', '~1 trillion'],
        ['Constellation', 'Andromeda']
      ],
      blurb: 'The nearest major galaxy to our own and the most distant thing visible to the naked eye. Andromeda is racing toward the Milky Way and will merge with it in about 4.5 billion years.',
      fun: [
        'Its light left 2.5 million years ago — you are seeing it as it was before modern humans existed.',
        'It holds about twice as many stars as the Milky Way.',
        'When it collides with us, the two will eventually form a single elliptical galaxy nicknamed "Milkomeda".'
      ]
    },
    {
      id: 'triangulum', name: 'Triangulum Galaxy', kind: 'galaxy', color: 0xbfd0ff,
      dispRad: 360, sky: { lon: 62, lat: 16, dist: 11600 },
      galaxy: { type: 'spiral', seed: 23, incl: 56, arms: 2, turns: 3.4, spin: 0.03,
        core: '255,234,198', arm: '160,196,255', hii: '255,140,180' },
      rows: [
        ['Designation', 'Messier 33 / NGC 598'],
        ['Type', 'Spiral (SA(s)cd)'],
        ['Distance', '2.7 million light-years'],
        ['Diameter', '~60,000 light-years'],
        ['Constellation', 'Triangulum']
      ],
      blurb: 'The third-largest member of our Local Group of galaxies, a delicate face-on spiral bursting with star-forming nebulae — including NGC 604, one of the largest known.',
      fun: [
        'Under very dark skies, sharp-eyed observers can just glimpse it without a telescope.',
        'It may be a distant satellite of the Andromeda Galaxy.',
        'It has no central bulge or supermassive black hole worth the name — unusual for a big spiral.'
      ]
    },
    {
      id: 'whirlpool', name: 'Whirlpool Galaxy', kind: 'galaxy', color: 0xd6dcff,
      dispRad: 300, sky: { lon: 205, lat: 54, dist: 13200 },
      galaxy: { type: 'spiral', seed: 51, incl: 22, arms: 2, turns: 2.6, spin: 0.035,
        core: '255,240,206', arm: '150,186,255', hii: '255,150,190' },
      rows: [
        ['Designation', 'Messier 51a / NGC 5194'],
        ['Type', 'Grand-design spiral'],
        ['Distance', '~31 million light-years'],
        ['Diameter', '~76,000 light-years'],
        ['Constellation', 'Canes Venatici']
      ],
      blurb: 'The classic "grand-design" spiral — its sweeping arms are textbook-perfect, stirred up by a small companion galaxy (NGC 5195) tugging at one arm.',
      fun: [
        'It was the first galaxy ever recognised to have spiral structure, by Lord Rosse in 1845.',
        'The ongoing collision with its little companion is what makes its arms so sharp and bright.',
        'It is a favourite target for backyard telescopes in the handle of the Big Dipper.'
      ]
    },
    {
      id: 'pinwheel', name: 'Pinwheel Galaxy', kind: 'galaxy', color: 0xd0dbff,
      dispRad: 400, sky: { lon: 158, lat: 60, dist: 13800 },
      galaxy: { type: 'spiral', seed: 101, incl: 18, arms: 4, turns: 2.4, spin: 0.03,
        core: '255,238,202', arm: '156,192,255', hii: '255,148,188' },
      rows: [
        ['Designation', 'Messier 101 / NGC 5457'],
        ['Type', 'Face-on spiral (SAB(rs)cd)'],
        ['Distance', '~21 million light-years'],
        ['Diameter', '~170,000 light-years'],
        ['Constellation', 'Ursa Major']
      ],
      blurb: 'A huge, near-perfectly face-on spiral about 70% larger than the Milky Way, freckled with giant glowing star-forming regions across its sprawling arms.',
      fun: [
        'It is one of the biggest disk galaxies known in our cosmic neighbourhood.',
        'Its arms are noticeably lopsided, likely from past gravitational encounters.',
        'A bright supernova flared in it in 2011, visible in amateur telescopes.'
      ]
    },
    {
      id: 'sombrero', name: 'Sombrero Galaxy', kind: 'galaxy', color: 0xe6d8b8,
      dispRad: 320, sky: { lon: 252, lat: -28, dist: 12500 },
      galaxy: { type: 'elliptical', seed: 104, incl: 84, roll: 0, dust: true, spin: 0,
        core: '255,236,196' },
      rows: [
        ['Designation', 'Messier 104 / NGC 4594'],
        ['Type', 'Edge-on spiral / lenticular'],
        ['Distance', '~31 million light-years'],
        ['Diameter', '~49,000 light-years'],
        ['Constellation', 'Virgo']
      ],
      blurb: 'Seen almost perfectly edge-on, this galaxy’s brilliant bulge and dark dust lane give it the look of a wide-brimmed hat — hence the name.',
      fun: [
        'Its core hides a supermassive black hole of about a billion Suns.',
        'It is wrapped in an unusually rich swarm of nearly 2,000 globular star clusters.',
        'The sharp dust lane is a ring of cold gas circling the galaxy edge-on to us.'
      ]
    },
    {
      id: 'centaurusa', name: 'Centaurus A', kind: 'galaxy', color: 0xe2d2bc,
      dispRad: 340, sky: { lon: 292, lat: -44, dist: 10600 },
      galaxy: { type: 'elliptical', seed: 5128, incl: 68, roll: 0, dust: true, spin: 0.006,
        core: '255,232,196' },
      rows: [
        ['Designation', 'NGC 5128'],
        ['Type', 'Peculiar elliptical (active galaxy)'],
        ['Distance', '~12 million light-years'],
        ['Diameter', '~98,000 light-years'],
        ['Constellation', 'Centaurus']
      ],
      blurb: 'The nearest active galaxy — a giant elliptical crossed by a dark dust lane, the wreckage of a spiral galaxy it swallowed. Its core blasts huge radio jets into space.',
      fun: [
        'It is one of the brightest radio sources in the entire sky.',
        'Twin jets from its central black hole stretch over a million light-years.',
        'The warped dust lane is the digesting remains of a smaller galaxy it ate.'
      ]
    },
    {
      id: 'lmc', name: 'Large Magellanic Cloud', kind: 'galaxy', color: 0xcfe0ff,
      dispRad: 320, sky: { lon: 280, lat: -66, dist: 7000 },
      galaxy: { type: 'irregular', seed: 70, incl: 38, spin: 0.012,
        arm: '170,200,255', hii: '255,150,180' },
      rows: [
        ['Type', 'Barred irregular dwarf'],
        ['Distance', '163,000 light-years'],
        ['Diameter', '~32,000 light-years'],
        ['Constellation', 'Dorado / Mensa'],
        ['Status', 'Satellite of the Milky Way']
      ],
      blurb: 'The largest satellite galaxy of the Milky Way, a ragged cloud of stars best seen from the southern hemisphere. It hosts the Tarantula Nebula, the most active star-forming region known nearby.',
      fun: [
        'Supernova 1987A, the closest observed supernova in modern times, flared here.',
        'It looks like a detached piece of the Milky Way to the naked eye.',
        'Ferdinand Magellan’s crew helped bring it to European attention in 1519.'
      ]
    },
    {
      id: 'smc', name: 'Small Magellanic Cloud', kind: 'galaxy', color: 0xc8daff,
      dispRad: 210, sky: { lon: 305, lat: -62, dist: 7300 },
      galaxy: { type: 'irregular', seed: 71, incl: 46, spin: 0.012,
        arm: '176,204,255', hii: '255,156,184' },
      rows: [
        ['Type', 'Irregular dwarf'],
        ['Distance', '200,000 light-years'],
        ['Diameter', '~18,900 light-years'],
        ['Constellation', 'Tucana'],
        ['Status', 'Satellite of the Milky Way']
      ],
      blurb: 'A smaller companion cloud to the LMC, the two linked by a bridge of gas torn out by the Milky Way’s gravity as they slowly fall toward us.',
      fun: [
        'It and the LMC trail a vast "Magellanic Stream" of gas halfway around our sky.',
        'It helped astronomer Henrietta Leavitt discover how to measure cosmic distances in 1908.',
        'Both Clouds may only be passing by, not permanently bound to the Milky Way.'
      ]
    },
    {
      id: 'm87', name: 'Messier 87', kind: 'galaxy', color: 0xf0e4c4,
      dispRad: 440, sky: { lon: 186, lat: 12, dist: 16000 },
      galaxy: { type: 'elliptical', seed: 87, incl: 12, spin: 0,
        core: '255,238,200' },
      rows: [
        ['Designation', 'Messier 87 / Virgo A'],
        ['Type', 'Supergiant elliptical'],
        ['Distance', '~53 million light-years'],
        ['Diameter', '~120,000 light-years'],
        ['Constellation', 'Virgo']
      ],
      blurb: 'A monstrous elliptical galaxy at the heart of the Virgo Cluster, home to the first black hole ever directly imaged (2019) and a brilliant jet of plasma thousands of light-years long.',
      fun: [
        'Its central black hole, M87*, weighs 6.5 billion Suns and was photographed by the Event Horizon Telescope.',
        'It contains an estimated 12,000 globular clusters, dwarfing the Milky Way’s ~150.',
        'Its blue jet, blasted from the black hole, is visible even in modest telescopes.'
      ]
    },

    /* ---- famous stars: placed by real RA/Dec so constellations form ---- */
    {
      id: 'sirius', name: 'Sirius', kind: 'star', color: 0xcfe0ff,
      star: { ra: 101.29, dec: -16.72, mag: -1.46, spect: '#cfe0ff' },
      rows: [['Constellation', 'Canis Major'], ['Distance', '8.6 light-years'],
        ['Type', 'A1V white main-sequence + white dwarf'], ['Apparent magnitude', '−1.46 (brightest star)']],
      blurb: 'The brightest star in the night sky — a hot white sun only 8.6 light-years away, with a dense white-dwarf companion, "the Pup", circling it.',
      fun: ['Ancient Egyptians timed the Nile floods by its dawn rising.',
        'Its twinkling, low on the horizon, flashes through every colour and is often mistaken for a UFO.',
        'The companion Sirius B packs the Sun’s mass into an Earth-sized ball.']
    },
    {
      id: 'canopus', name: 'Canopus', kind: 'star', color: 0xfff4e0,
      star: { ra: 95.99, dec: -52.70, mag: -0.74, spect: '#fff4e0' },
      rows: [['Constellation', 'Carina'], ['Distance', '~310 light-years'],
        ['Type', 'A9 / F0 bright giant'], ['Apparent magnitude', '−0.74 (2nd brightest)']],
      blurb: 'The second-brightest star in the sky, a luminous southern giant 10,000 times brighter than the Sun. Spacecraft use it as a navigation reference.',
      fun: ['Many interplanetary probes carry a "Canopus star tracker" to orient themselves.',
        'It never rises for most of Europe and the northern United States.',
        'It shines with the light of about 10,000 Suns.']
    },
    {
      id: 'alphacen', name: 'Alpha Centauri', kind: 'star', color: 0xfff0c8,
      star: { ra: 219.90, dec: -60.83, mag: -0.27, spect: '#fff0c8' },
      rows: [['Constellation', 'Centaurus'], ['Distance', '4.37 light-years'],
        ['Type', 'G2V + K1V (+ red dwarf Proxima)'], ['Apparent magnitude', '−0.27 (combined)']],
      blurb: 'The closest star system to the Sun — a Sun-like pair with the red dwarf Proxima Centauri, which hosts the nearest known exoplanet, Proxima b.',
      fun: ['At 4.37 light-years it is our nearest stellar neighbour.',
        'The Breakthrough Starshot project dreams of sending tiny probes here within a human lifetime.',
        'Alpha Centauri A is almost a twin of our own Sun.']
    },
    {
      id: 'arcturus', name: 'Arcturus', kind: 'star', color: 0xffc890,
      star: { ra: 213.92, dec: 19.18, mag: -0.05, spect: '#ffc890' },
      rows: [['Constellation', 'Boötes'], ['Distance', '36.7 light-years'],
        ['Type', 'K0 III orange giant'], ['Apparent magnitude', '−0.05']],
      blurb: 'A glowing orange giant, the brightest star in the northern sky. It is racing through the galaxy at right angles to the disk, part of an ancient stellar stream.',
      fun: ['Its light was used to open the 1933 Chicago World’s Fair.',
        'Follow the curve of the Big Dipper’s handle to "arc to Arcturus".',
        'It is about 25 times the Sun’s diameter.']
    },
    {
      id: 'vega', name: 'Vega', kind: 'star', color: 0xdfe8ff,
      star: { ra: 279.23, dec: 38.78, mag: 0.03, spect: '#dfe8ff' },
      rows: [['Constellation', 'Lyra'], ['Distance', '25 light-years'],
        ['Type', 'A0V white main-sequence'], ['Apparent magnitude', '0.03']],
      blurb: 'A brilliant blue-white star that was once the North Star and will be again. Vega is the zero-point against which star brightnesses were historically calibrated.',
      fun: ['Earth’s wobble will make Vega the pole star again around the year 13,727.',
        'It is encircled by a disk of dust — possibly a forming planetary system.',
        'It was the first star ever photographed (1850) and the setting of the novel/film "Contact".']
    },
    {
      id: 'capella', name: 'Capella', kind: 'star', color: 0xfff0c8,
      star: { ra: 79.17, dec: 45.99, mag: 0.08, spect: '#fff0c8' },
      rows: [['Constellation', 'Auriga'], ['Distance', '43 light-years'],
        ['Type', 'Two yellow giants (G-type)'], ['Apparent magnitude', '0.08']],
      blurb: 'The "little she-goat" — actually two yellow giant stars orbiting each other closely, the most northerly first-magnitude star.',
      fun: ['What looks like one star is really four, in two pairs.',
        'It is the sixth-brightest star in the night sky.',
        'For far-northern observers it never sets.']
    },
    {
      id: 'rigel', name: 'Rigel', kind: 'star', color: 0xbcd0ff,
      star: { ra: 78.63, dec: -8.20, mag: 0.18, spect: '#bcd0ff' },
      rows: [['Constellation', 'Orion (left foot)'], ['Distance', '~860 light-years'],
        ['Type', 'B8 blue supergiant'], ['Apparent magnitude', '0.18']],
      blurb: 'A dazzling blue supergiant marking Orion’s foot, around 120,000 times more luminous than the Sun and one of the most powerful stars visible to the eye.',
      fun: ['Despite being far dimmer-looking than nearby Betelgeuse in luminosity terms, it usually outshines it.',
        'It is a young star destined to end in a supernova.',
        'It has faint companion stars huddled beside it.']
    },
    {
      id: 'procyon', name: 'Procyon', kind: 'star', color: 0xfff2e0,
      star: { ra: 114.83, dec: 5.22, mag: 0.34, spect: '#fff2e0' },
      rows: [['Constellation', 'Canis Minor'], ['Distance', '11.5 light-years'],
        ['Type', 'F5 subgiant + white dwarf'], ['Apparent magnitude', '0.34']],
      blurb: 'A nearby yellow-white star, the eighth-brightest in the sky. With Sirius and Betelgeuse it forms the bright "Winter Triangle".',
      fun: ['Its name means "before the dog", as it rises just ahead of Sirius the Dog Star.',
        'Like Sirius, it has a white-dwarf companion.',
        'It is only 11.5 light-years away.']
    },
    {
      id: 'betelgeuse', name: 'Betelgeuse', kind: 'star', color: 0xff7d5a,
      star: { ra: 88.79, dec: 7.41, mag: 0.45, spect: '#ff7d5a' },
      rows: [['Constellation', 'Orion (shoulder)'], ['Distance', '~550 light-years'],
        ['Type', 'M1 red supergiant'], ['Apparent magnitude', '0.0–1.6 (variable)']],
      blurb: 'A vast, dying red supergiant so huge it would swallow Jupiter’s orbit if placed at the Sun. It will explode as a supernova — astronomically soon.',
      fun: ['In 2019–2020 it mysteriously dimmed; a dust cloud it had belched out was the culprit.',
        'When it goes supernova it will briefly rival the Moon and be visible in daylight.',
        'It is so big that its surface boils in titanic, slowly churning cells.']
    },
    {
      id: 'aldebaran', name: 'Aldebaran', kind: 'star', color: 0xffb878,
      star: { ra: 68.98, dec: 16.51, mag: 0.86, spect: '#ffb878' },
      rows: [['Constellation', 'Taurus (the eye)'], ['Distance', '65 light-years'],
        ['Type', 'K5 orange giant'], ['Apparent magnitude', '0.86']],
      blurb: 'The fiery orange eye of Taurus the Bull, glaring out near the Hyades and Pleiades star clusters (though it sits well in front of them).',
      fun: ['Pioneer 10 is drifting toward it and will pass near it in about 2 million years.',
        'It is around 44 times the Sun’s diameter.',
        'Its name is Arabic for "the follower", trailing the Pleiades across the sky.']
    },
    {
      id: 'antares', name: 'Antares', kind: 'star', color: 0xff8a5e,
      star: { ra: 247.35, dec: -26.43, mag: 1.06, spect: '#ff8a5e' },
      rows: [['Constellation', 'Scorpius (the heart)'], ['Distance', '~550 light-years'],
        ['Type', 'M1 red supergiant'], ['Apparent magnitude', '0.6–1.6 (variable)']],
      blurb: 'The blood-red heart of the Scorpion, a red supergiant rivalling Betelgeuse in size. Its name means "rival of Mars" for its similar ruddy glow.',
      fun: ['If placed at the Sun, its surface would reach beyond the orbit of Mars.',
        'It too is a future supernova.',
        'The Moon regularly passes in front of it, a rare bright-star occultation.']
    },
    {
      id: 'spica', name: 'Spica', kind: 'star', color: 0xc8d8ff,
      star: { ra: 201.30, dec: -11.16, mag: 0.98, spect: '#c8d8ff' },
      rows: [['Constellation', 'Virgo'], ['Distance', '250 light-years'],
        ['Type', 'B1 blue giant pair'], ['Apparent magnitude', '0.98']],
      blurb: 'A hot blue pair of stars whirling around each other every four days, so close they are egg-shaped. "Spica" means the ear of wheat held by Virgo.',
      fun: ['"Drive a spike to Spica" by continuing the arc past Arcturus.',
        'The two stars distort each other into elongated shapes.',
        'It is one of the nearest stars massive enough to one day explode.']
    },
    {
      id: 'pollux', name: 'Pollux', kind: 'star', color: 0xffcf98,
      star: { ra: 116.33, dec: 28.03, mag: 1.14, spect: '#ffcf98' },
      rows: [['Constellation', 'Gemini (a twin)'], ['Distance', '34 light-years'],
        ['Type', 'K0 orange giant'], ['Apparent magnitude', '1.14']],
      blurb: 'The brighter of the Gemini twins, an orange giant with a confirmed planet — one of the nearest giant stars known to host a world.',
      fun: ['Its planet, Pollux b, is about twice Jupiter’s mass.',
        'It outshines its "twin" Castor despite Castor’s "alpha" designation.',
        'It lies just 34 light-years away.']
    },
    {
      id: 'deneb', name: 'Deneb', kind: 'star', color: 0xeef2ff,
      star: { ra: 310.36, dec: 45.28, mag: 1.25, spect: '#eef2ff' },
      rows: [['Constellation', 'Cygnus (the tail)'], ['Distance', '~1,500 light-years'],
        ['Type', 'A2 blue-white supergiant'], ['Apparent magnitude', '1.25']],
      blurb: 'One of the most luminous stars known — a blue-white supergiant blazing with perhaps 200,000 Suns, yet looking modest only because it is so far away.',
      fun: ['It anchors one corner of the Summer Triangle with Vega and Altair.',
        'If it were as close as Sirius it would cast shadows at night.',
        'It marks the tail of Cygnus the Swan, flying down the Milky Way.']
    },
    {
      id: 'regulus', name: 'Regulus', kind: 'star', color: 0xd2e2ff,
      star: { ra: 152.09, dec: 11.97, mag: 1.40, spect: '#d2e2ff' },
      rows: [['Constellation', 'Leo (the heart)'], ['Distance', '79 light-years'],
        ['Type', 'B8 blue-white main-sequence'], ['Apparent magnitude', '1.40']],
      blurb: 'The "little king" at the heart of Leo. It spins so fast — once every 16 hours — that it is squashed into a flattened, egg-like shape.',
      fun: ['If it spun just 10% faster, it would fly apart.',
        'It sits almost exactly on the ecliptic, so the Moon and planets often pass it.',
        'It is really a four-star system.']
    },
    {
      id: 'altair', name: 'Altair', kind: 'star', color: 0xe8efff,
      star: { ra: 297.70, dec: 8.87, mag: 0.76, spect: '#e8efff' },
      rows: [['Constellation', 'Aquila'], ['Distance', '16.7 light-years'],
        ['Type', 'A7 white main-sequence'], ['Apparent magnitude', '0.76']],
      blurb: 'A nearby fast-spinning white star, the third corner of the Summer Triangle. It rotates so quickly its equator bulges noticeably.',
      fun: ['It completes a rotation in about 9 hours, versus the Sun’s 25 days.',
        'It is one of the few stars whose actual surface has been imaged.',
        'At 16.7 light-years it is a close neighbour.']
    },
    {
      id: 'fomalhaut', name: 'Fomalhaut', kind: 'star', color: 0xe6eeff,
      star: { ra: 344.41, dec: -29.62, mag: 1.16, spect: '#e6eeff' },
      rows: [['Constellation', 'Piscis Austrinus'], ['Distance', '25 light-years'],
        ['Type', 'A3 white main-sequence'], ['Apparent magnitude', '1.16']],
      blurb: 'The "lonely star of autumn", a young white sun girdled by a sharp ring of dusty debris — one of the first such disks ever directly photographed.',
      fun: ['Its dust ring is so crisp it is nicknamed "the Eye of Sauron".',
        'A controversial object once thought to be a planet there turned out to be an expanding dust cloud.',
        'It shines alone in an otherwise dim patch of sky.']
    },
    {
      id: 'polaris', name: 'Polaris', kind: 'star', color: 0xfff6ea,
      star: { ra: 37.95, dec: 89.26, mag: 1.98, spect: '#fff6ea' },
      rows: [['Constellation', 'Ursa Minor'], ['Distance', '~430 light-years'],
        ['Type', 'F7 supergiant (Cepheid)'], ['Apparent magnitude', '1.98']],
      blurb: 'The North Star — sitting almost exactly above Earth’s north pole, so it barely moves while the whole sky wheels around it. Navigators have steered by it for centuries.',
      fun: ['It is a Cepheid variable, gently pulsing in brightness.',
        'It will not always be the pole star — in 12,000 years that honour passes to Vega.',
        'The two front stars of the Big Dipper’s bowl point straight to it.']
    },
    {
      id: 'bellatrix', name: 'Bellatrix', kind: 'star', color: 0xc4d6ff,
      star: { ra: 81.28, dec: 6.35, mag: 1.64, spect: '#c4d6ff' },
      rows: [['Constellation', 'Orion (shoulder)'], ['Distance', '250 light-years'],
        ['Type', 'B2 blue giant'], ['Apparent magnitude', '1.64']],
      blurb: 'The "female warrior" marking Orion’s left shoulder — a hot blue giant and one of the hottest stars easily visible to the naked eye.',
      fun: ['It is sometimes called the "Amazon Star".',
        'It glows with a distinctly blue-white hue beside ruddy Betelgeuse.']
    },
    {
      id: 'saiph', name: 'Saiph', kind: 'star', color: 0xcbe0ff,
      star: { ra: 86.94, dec: -9.67, mag: 2.07, spect: '#cbe0ff' },
      rows: [['Constellation', 'Orion (knee)'], ['Distance', '~650 light-years'],
        ['Type', 'B0 blue supergiant'], ['Apparent magnitude', '2.07']],
      blurb: 'A blue supergiant marking Orion’s right knee. Though as luminous as Rigel, much of its output is invisible ultraviolet, so it looks fainter.',
      fun: ['Its name means "sword of the giant" in Arabic.',
        'Like the other Orion supergiants, it will end as a supernova.']
    },
    {
      id: 'alnitak', name: 'Alnitak', kind: 'star', color: 0xb8ccff,
      star: { ra: 85.19, dec: -1.94, mag: 1.77, spect: '#b8ccff' },
      rows: [['Constellation', 'Orion (belt, east)'], ['Distance', '~1,260 light-years'],
        ['Type', 'O9 blue supergiant'], ['Apparent magnitude', '1.77']],
      blurb: 'The eastern star of Orion’s Belt, a brilliant triple system whose searing light illuminates the nearby Flame and Horsehead Nebulae.',
      fun: ['It is one of the closest O-type (hottest class) stars to Earth.',
        'The famous Horsehead Nebula is silhouetted just beside it.']
    },
    {
      id: 'alnilam', name: 'Alnilam', kind: 'star', color: 0xc0d4ff,
      star: { ra: 84.05, dec: -1.20, mag: 1.69, spect: '#c0d4ff' },
      rows: [['Constellation', 'Orion (belt, centre)'], ['Distance', '~2,000 light-years'],
        ['Type', 'B0 blue supergiant'], ['Apparent magnitude', '1.69']],
      blurb: 'The central jewel of Orion’s Belt — a colossal blue supergiant shining with around 400,000 Suns from nearly 2,000 light-years away.',
      fun: ['It is losing mass in a strong stellar wind, wrapped in its own glowing nebula.',
        'It is among the most luminous stars you can see without a telescope.']
    },
    {
      id: 'mintaka', name: 'Mintaka', kind: 'star', color: 0xbcd0ff,
      star: { ra: 83.00, dec: -0.30, mag: 2.23, spect: '#bcd0ff' },
      rows: [['Constellation', 'Orion (belt, west)'], ['Distance', '~1,200 light-years'],
        ['Type', 'O/B multiple system'], ['Apparent magnitude', '2.23']],
      blurb: 'The western star of Orion’s Belt, sitting almost exactly on the celestial equator — so it rises due east and sets due west for the whole world.',
      fun: ['It is a complex system of at least five stars.',
        'Because it straddles the equator, everyone on Earth can see it.']
    },
    {
      id: 'dubhe', name: 'Dubhe', kind: 'star', color: 0xffd0a0,
      star: { ra: 165.93, dec: 61.75, mag: 1.79, spect: '#ffd0a0' },
      rows: [['Constellation', 'Ursa Major (pointer)'], ['Distance', '123 light-years'],
        ['Type', 'K0 orange giant'], ['Apparent magnitude', '1.79']],
      blurb: 'The upper "pointer" star of the Big Dipper’s bowl. A line from Dubhe through Merak points straight at Polaris, the North Star.',
      fun: ['It and Merak are the famous "Pointers" to the pole.',
        'Unlike most of the Dipper, it is not part of the same moving star group — it just happens to lie along the pattern.']
    },
    {
      id: 'merak', name: 'Merak', kind: 'star', color: 0xe6eeff,
      star: { ra: 165.46, dec: 56.38, mag: 2.37, spect: '#e6eeff' },
      rows: [['Constellation', 'Ursa Major (pointer)'], ['Distance', '79 light-years'],
        ['Type', 'A1 white main-sequence'], ['Apparent magnitude', '2.37']],
      blurb: 'The lower "pointer" of the Big Dipper’s bowl, partnering Dubhe to aim sky-watchers toward Polaris.',
      fun: ['Merak and Dubhe are the "Pointer Stars".',
        'It is surrounded by a disk of dust, like Vega and Fomalhaut.']
    },
    {
      id: 'phecda', name: 'Phecda', kind: 'star', color: 0xe6eeff,
      star: { ra: 178.46, dec: 53.69, mag: 2.44, spect: '#e6eeff' },
      rows: [['Constellation', 'Ursa Major (bowl)'], ['Distance', '84 light-years'],
        ['Type', 'A0 white main-sequence'], ['Apparent magnitude', '2.44']],
      blurb: 'A white star at the bottom of the Big Dipper’s bowl, part of the cluster of stars that share a common drift through the galaxy.',
      fun: ['Most of the Dipper’s stars belong to the same moving group, born together.',
        'It lies where the bowl meets the handle.']
    },
    {
      id: 'megrez', name: 'Megrez', kind: 'star', color: 0xe6eeff,
      star: { ra: 183.86, dec: 57.03, mag: 3.31, spect: '#e6eeff' },
      rows: [['Constellation', 'Ursa Major (bowl/handle)'], ['Distance', '58 light-years'],
        ['Type', 'A3 white main-sequence'], ['Apparent magnitude', '3.31']],
      blurb: 'The faintest of the seven Big Dipper stars, where the bowl joins the handle. Its dimness is a handy test of how dark your sky is.',
      fun: ['If you can’t spot Megrez, light pollution is washing out your sky.',
        'Its name means "root of the tail" of the Great Bear.']
    },
    {
      id: 'alioth', name: 'Alioth', kind: 'star', color: 0xeef2ff,
      star: { ra: 193.51, dec: 55.96, mag: 1.77, spect: '#eef2ff' },
      rows: [['Constellation', 'Ursa Major (handle)'], ['Distance', '82 light-years'],
        ['Type', 'A0 peculiar main-sequence'], ['Apparent magnitude', '1.77']],
      blurb: 'The brightest star of the Big Dipper, first in the handle. Its spectrum shows odd, shifting chemical patches dragged around by a strong magnetic field.',
      fun: ['It is the brightest of the seven Dipper stars.',
        'Its surface chemistry seems to change as it rotates.']
    },
    {
      id: 'mizar', name: 'Mizar', kind: 'star', color: 0xe8eeff,
      star: { ra: 200.98, dec: 54.93, mag: 2.04, spect: '#e8eeff' },
      rows: [['Constellation', 'Ursa Major (handle)'], ['Distance', '83 light-years'],
        ['Type', 'A2 quadruple system'], ['Apparent magnitude', '2.04']],
      blurb: 'The handle star famous for its naked-eye companion Alcor — a classic eyesight test. Mizar itself is the first star found to be a telescopic double, and is really four stars.',
      fun: ['Spotting faint Alcor beside Mizar was an ancient vision test.',
        'Mizar was the first double star ever photographed (1857).']
    },
    {
      id: 'alkaid', name: 'Alkaid', kind: 'star', color: 0xcfe0ff,
      star: { ra: 206.89, dec: 49.31, mag: 1.86, spect: '#cfe0ff' },
      rows: [['Constellation', 'Ursa Major (handle tip)'], ['Distance', '104 light-years'],
        ['Type', 'B3 blue main-sequence'], ['Apparent magnitude', '1.86']],
      blurb: 'The hot blue star at the very end of the Big Dipper’s handle. Its arc points the way onward "to Arcturus and Spica".',
      fun: ['Its name comes from Arabic for "leader of the mourners".',
        'Unlike the bowl stars, it does not share the Dipper’s common motion.']
    },

    /* ---- black holes ---- */
    {
      id: 'sgra', name: 'Sagittarius A*', kind: 'blackhole', color: 0xffb060,
      dispRad: 150, bh: { ra: 266.42, dec: -29.01, dist: 18000, tilt: 76, disk: '#ffcaa0' },
      rows: [
        ['Type', 'Supermassive black hole'],
        ['Mass', '~4.3 million Suns'],
        ['Distance', '~26,000 light-years'],
        ['Location', 'Centre of the Milky Way (Sagittarius)'],
        ['Imaged', '2022, Event Horizon Telescope']
      ],
      blurb: 'The supermassive black hole at the heart of our own galaxy. Every star in the Milky Way, including the Sun, orbits this dark giant — the Sun takes ~230 million years to go around once.',
      fun: [
        'In 2022 the Event Horizon Telescope captured its glowing ring of doomed light.',
        'Stars near it whip around at thousands of km/s, and watching them won astronomers a Nobel Prize.',
        'Its "shadow" is about the size of Mercury’s orbit, yet sits 26,000 light-years away.'
      ]
    },
    {
      id: 'm87star', name: 'M87*', kind: 'blackhole', color: 0xffb866,
      dispRad: 250, bh: { ra: 187.7, dec: 12.34, dist: 15400, tilt: 60, disk: '#ffd0a0' },
      rows: [
        ['Type', 'Supermassive black hole'],
        ['Mass', '6.5 billion Suns'],
        ['Distance', '~53 million light-years'],
        ['Location', 'Core of galaxy M87 (Virgo)'],
        ['Imaged', '2019 — first black hole ever pictured']
      ],
      blurb: 'The first black hole humanity ever photographed. In April 2019 the Event Horizon Telescope revealed its fiery orange ring of light bending around a pit of pure darkness.',
      fun: [
        'It is so massive its event horizon is larger than our entire Solar System.',
        'It fires a jet of plasma 5,000 light-years long at nearly the speed of light.',
        'Taking its picture required linking radio telescopes across the whole Earth.'
      ]
    },
    {
      id: 'cygx1', name: 'Cygnus X-1', kind: 'blackhole', color: 0x9fc0ff,
      dispRad: 90, bh: { ra: 299.59, dec: 35.20, dist: 9000, tilt: 68, disk: '#bcd6ff' },
      rows: [
        ['Type', 'Stellar-mass black hole'],
        ['Mass', '~21 Suns'],
        ['Distance', '7,000 light-years'],
        ['Companion', 'Blue supergiant being devoured'],
        ['Discovered', '1964 (X-rays); confirmed 1971']
      ],
      blurb: 'The first object widely accepted as a black hole. It tears gas from a giant blue companion star into a searing accretion disk that blazes in X-rays.',
      fun: [
        'Stephen Hawking famously bet Kip Thorne it was NOT a black hole — and conceded in 1990.',
        'The stolen stellar gas spirals in at millions of degrees, glowing in X-rays before it vanishes.',
        'It spins more than 800 times per second.'
      ]
    },
    {
      id: 'ton618', name: 'TON 618', kind: 'blackhole', color: 0xffd9a8,
      dispRad: 320, bh: { ra: 184.0, dec: 28.5, dist: 26000, tilt: 52, disk: '#ffe0b0' },
      rows: [
        ['Type', 'Ultramassive black hole (quasar)'],
        ['Mass', '~66 billion Suns'],
        ['Distance', '~18.2 billion light-years'],
        ['Power', 'Quasar — 140 trillion Suns of light']
      ],
      blurb: 'One of the most massive black holes known — a monster of 66 billion Suns powering a quasar so brilliant we see it across almost the entire observable universe.',
      fun: [
        'Its event horizon is wide enough to swallow our Solar System hundreds of times over.',
        'We see it as it was in the young universe, over 10 billion years ago.',
        'As a quasar it outshines its entire host galaxy by a thousandfold.'
      ]
    },

    /* ---- nebulae ---- */
    {
      id: 'orionneb', name: 'Orion Nebula', kind: 'nebula', color: 0xff9ec0,
      dispRad: 280, neb: { ra: 83.82, dec: -5.39, dist: 6000, seed: 42,
        cols: ['255,96,150', '120,170,255', '255,180,210', '170,120,255'] },
      rows: [
        ['Designation', 'Messier 42'],
        ['Type', 'Emission nebula / star nursery'],
        ['Distance', '1,344 light-years'],
        ['Diameter', '~24 light-years'],
        ['Constellation', "Orion's Sword"]
      ],
      blurb: 'The nearest large stellar nursery — a glowing cloud where new stars and planetary systems are being born right now. It hangs just below the three belt stars of Orion.',
      fun: [
        'You can see it with the naked eye as the fuzzy middle "star" of Orion’s sword.',
        'At its heart, four hot young stars called the Trapezium light the whole cloud up.',
        'Astronomers watch infant solar systems — "proplyds" — taking shape inside it.'
      ]
    },
    {
      id: 'crabneb', name: 'Crab Nebula', kind: 'nebula', color: 0xffc080,
      dispRad: 200, neb: { ra: 83.63, dec: 22.01, dist: 6800, seed: 1054,
        cols: ['255,140,80', '120,200,255', '255,90,120', '180,255,200'] },
      rows: [
        ['Designation', 'Messier 1'],
        ['Type', 'Supernova remnant'],
        ['Distance', '~6,500 light-years'],
        ['Diameter', '~11 light-years'],
        ['Source', 'Supernova of AD 1054']
      ],
      blurb: 'The shredded wreckage of a star that exploded in AD 1054 — a supernova so bright it was recorded in daylight by Chinese astronomers. At its centre spins a city-sized neutron star.',
      fun: [
        'The Crab Pulsar at its core spins 30 times every second, sweeping beams like a lighthouse.',
        'Its filaments are still rushing outward at about 1,500 km/s.',
        'It was the very first object in Charles Messier’s famous catalogue (M1).'
      ]
    }
  ];

  const constellations = [
    { name: 'Orion', pairs: [
      ['betelgeuse', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'],
      ['alnitak', 'alnilam'], ['alnilam', 'mintaka'], ['alnitak', 'saiph'], ['mintaka', 'rigel']
    ] },
    { name: 'Big Dipper', pairs: [
      ['alkaid', 'mizar'], ['mizar', 'alioth'], ['alioth', 'megrez'], ['megrez', 'phecda'],
      ['phecda', 'merak'], ['merak', 'dubhe'], ['dubhe', 'megrez']
    ] }
  ];

  const byId = {};
  for (const b of bodies) {
    if (b.radiusKm && b.dispRad === undefined) b.dispRad = dispR(b.radiusKm);
    byId[b.id] = b;
  }

  return { AU, bodies, byId, dispR, constellations };
})();
