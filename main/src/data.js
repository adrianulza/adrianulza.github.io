// All page content: who I am, the works, the publications and the books.

export const person = {
  name: 'Adrian Ulza',
  role: 'Structural engineer',
  place: 'Banda Aceh, Indonesia',
  roles: [
    { title: 'Lecturer in Structural Engineering', org: 'Department of Civil Engineering, Universitas Syiah Kuala' },
    { title: 'Researcher', org: 'Tsunami and Disaster Mitigation Research Center (TDMRC)' },
  ],
  interests: [
    'Performance-based seismic design',
    'Seismic fragility and vulnerability',
    'Structural health monitoring',
    'Machine learning for seismic risk',
    'Open engineering software',
  ],
  links: [
    { label: 'Email', href: 'mailto:adrian_ulza@usk.ac.id' },
    { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=nGB_HtQAAAAJ' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/adrianulza/' },
    { label: 'GitHub', href: 'https://github.com/adrianulza' },
  ],
};

export const works = [
  {
    id: 'asfrava-b', title: 'ASFRAVA-B', kind: 'Research software', year: '2025',
    pitch: 'A free Windows app that turns a pushover curve and a set of ground motions into seismic fragility and vulnerability curves.',
    facts: [
      { value: 'Q1', label: 'International Journal of Disaster Risk Reduction, 2025' },
      { value: 'MIT', label: 'Open source, one-click release' },
      { value: '1.1', label: 'Current version, with IDA and non-crossing curves' },
    ],
    links: [
      { label: 'Paper', href: 'https://doi.org/10.1016/j.ijdrr.2025.105679' },
      { label: 'Code', href: 'https://github.com/adrianulza/ASFRAVA-B' },
    ],
    glyph: 'fragility',
  },
  {
    id: 'openanstruk', title: 'OpenAnstruk', kind: 'Software', year: '2026',
    media: { src: 'media/openanstruk.webp', alt: 'OpenAnstruk-2D in the browser: a two-bay portal frame modelled on the grid, ready to analyse' },
    pitch: 'Structural analysis and design in the browser. Free, open, and no install.',
    facts: [
      { value: '2.8×10⁻¹⁴', label: 'Largest disagreement with reference solutions over 1,276 checks' },
      { value: 'SNI · ACI · AISC', label: 'Reinforced concrete and steel design checks' },
      { value: 'Live', label: 'Drag a node and the whole frame answers in real time' },
    ],
    links: [
      { label: 'Open the app', href: 'https://openanstruk.org' },
      { label: 'Code', href: 'https://github.com/adrianulza/OpenANSTRUK-2D' },
    ],
    glyph: 'frame',
  },
  {
    id: 'sim-geumpa', title: 'SIM-GEUMPA', kind: 'Instrument', year: '2026',
    pitch: 'A uni-axial shaking table that replays real earthquakes. Geumpa is Acehnese for earthquake.',
    facts: [
      { value: '100-104%', label: 'Of commanded stroke delivered from 1 to 8 Hz' },
      { value: '≈7%', label: 'Chi-Chi 1999 replayed within this on the response spectrum' },
      { value: 'TDMRC', label: 'Built in-house in Banda Aceh' },
    ],
    links: [
      { label: 'Code', href: 'https://github.com/adrianulza/SIM-GEUMPA' },
      { label: 'News', href: 'https://tdmrc.usk.ac.id/2026/06/08/researchers-from-tdmrc-usk-develop-sim-geumpa-an-in-house-earthquake-simulator-as-a-milestone-in-infrastructure-resilience-research' },
    ],
    glyph: 'table',
  },
  {
    id: 'superiska', title: 'supeRISKa lite', kind: 'Risk model', year: '2025',
    pitch: 'Decision support for disaster risk financing: earthquake and tsunami losses to public buildings.',
    facts: [
      { value: '103,779', label: 'Public buildings in the asset model' },
      { value: '15', label: 'Provinces across Sumatra and Kalimantan' },
      { value: 'Oct 2025', label: 'Presented to Aceh government agencies' },
    ],
    links: [
      { label: 'Workshop', href: 'https://tdmrc.usk.ac.id/2025/10/30/tdmrc-usk-held-a-workshop-on-the-utilization-of-superiska-and-building-database-for-disaster-management-in-banda-aceh-as-part-of-the-in-saintek-2025-program/' },
    ],
    glyph: 'loss',
  },
  {
    id: 'siaga-banjir', title: 'Siaga Banjir', kind: 'Game', year: '2026',
    media: { src: 'media/siaga-banjir.webp', alt: 'Siaga Banjir: an illustrated riverside village where a family prepares for a flood' },
    pitch: 'A browser game that teaches families to prepare for, survive and recover from floods.',
    facts: [
      { value: '3', label: 'Phases: prepare, respond, recover' },
      { value: 'MIT', label: 'Open source' },
      { value: 'Free', label: 'Plays in any browser, in Bahasa Indonesia' },
    ],
    links: [
      { label: 'Play', href: 'https://adrianulza.github.io/game-siaga-banjir/' },
      { label: 'Code', href: 'https://github.com/adrianulza/game-siaga-banjir' },
    ],
    glyph: 'flood',
  },
];

export const publications = [
  { year: 2025, title: 'Automated Seismic Fragility and Vulnerability Assessment for Buildings (ASFRAVA-B): Integrating Probabilistic Seismic Design into Performance-Based Engineering Practices', authors: 'A. Ulza, Y. Idris, M. A. Ramadhan, Syamsidik, Z. Amalia', venue: 'International Journal of Disaster Risk Reduction 127, 105679', href: 'https://doi.org/10.1016/j.ijdrr.2025.105679' },
  { year: 2025, title: 'Analisis Respons Spektrum: State-of-the-Art dan Pengembangan Kerangka Pemrograman untuk Komputasi', authors: 'A. Ulza, M. Afifuddin, T. B. Aulia, H. Huzaim, A. Abdullah', venue: 'Jurnal Teknik Sipil 14(1), 23-32', href: 'https://doi.org/10.24815/jts.v14i1.44764' },
  { year: 2025, title: 'Pengaruh Pemodelan Soil-Structure Interaction pada Kinerja Struktur: Studi Kasus Tipologi Bangunan Sekolah Indonesia', authors: 'A. Ulza, H. Yunita, Y. Idris, R. S. Faradiba', venue: 'Jurnal Teknik Sipil dan Teknologi Konstruksi 11(1)', href: 'https://doi.org/10.35308/jts-utu.v11i1.11549' },
  { year: 2025, title: 'Concrete Jacketing for Strength Enhancement of Square Columns in Corroded Reinforced Concrete Structures', authors: 'Z. Amalia, Mahlil, A. Ulza, T. Saidi, T. B. Aulia, C. N. Asyifa', venue: 'TEKNIK 46(3), 270-278', href: 'https://doi.org/10.14710/teknik.v46i3.70449' },
  { year: 2025, title: 'Reviewing the Earthquake Performance of Typical Confined Masonry Residential Houses in Aceh', authors: 'A. Ulza, Y. Idris, Y. Hayati, Mahlil', venue: 'Springer Proceedings in Earth and Environmental Sciences (AIWEST 2022), 271-288', href: 'https://doi.org/10.1007/978-3-031-81072-5_18' },
  { year: 2024, title: 'Integrating Building Information Modelling (BIM) for Improved Assessment and Seismic Evaluation of Existing Buildings: A Case Study', authors: 'A. Ulza, P. A. Kesuma, I. S. Hilal, A. Rahmad, T. A. Cut Fatmawati, J. Ardika, I. Meilinda', venue: 'Journal of Physics: Conference Series 2916, 012022', href: 'https://doi.org/10.1088/1742-6596/2916/1/012022' },
  { year: 2023, title: 'Closing the Resilience Gap: A Preliminary Study on Establishing the National Fragility Curve Catalog for Multi-Hazard Assessment in Indonesia', authors: 'A. Ulza, Y. Idris, C. N. Asyifa, R. Irvansyah', venue: 'E3S Web of Conferences 447, 01002', href: 'https://doi.org/10.1051/e3sconf/202344701002' },
  { year: 2022, title: 'Earthquake Vulnerability Assessment of the 6.5 Mw Pidie Jaya Earthquake: Analytical-Based Fragility Curves', authors: 'A. Ulza, Y. Idris', venue: 'E3S Web of Conferences 340, 02008', href: 'https://doi.org/10.1051/e3sconf/202234002008' },
];

export const books = [
  { title: 'Teori dan Praktik Evaluasi Struktur Beton Bertulang Berbasis Desain Kinerja', publisher: 'Deepublish', year: '2021', pages: '284', isbn: '978-623-02-2517-8', blurb: 'Performance-based seismic evaluation of reinforced concrete buildings: the methods of ATC-40, FEMA, Eurocode and ASCE 41, worked by hand and checked against computer analysis.', href: 'https://deepublishstore.com/produk/buku-teori-dan-praktik-evaluasi/' },
  { title: 'Teori dan Praktik Perancangan Struktur Gedung Tahan Gempa', publisher: 'Deepublish', blurb: 'The design of earthquake-resistant buildings, from theory to the practice of structural design.', href: 'https://deepublishstore.com/produk/buku-teori-dan-praktik-perancangan-struktur-gedung-tahan-gempa/' },
];

// The seven "memories" in the network: five works, then publications and books.
export const memories = [
  ...works,
  {
    id: 'publications', title: 'Publications', kind: 'Papers', year: '2022-2025',
    pitch: 'Seismic fragility, structural performance and disaster risk, in journals and proceedings.',
    facts: [
      { value: String(publications.length), label: 'Papers listed on Google Scholar' },
      { value: 'Q1', label: 'International Journal of Disaster Risk Reduction, 2025' },
      { value: '2022', label: 'First paper, on the Pidie Jaya earthquake' },
    ],
    links: [{ label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=nGB_HtQAAAAJ' }],
    glyph: 'papers',
  },
  {
    id: 'books', title: 'Books', kind: 'Books', year: 'Deepublish',
    pitch: 'Two books for students and engineers on the seismic design and evaluation of buildings.',
    facts: [
      { value: String(books.length), label: 'Books with Deepublish' },
      { value: '284', label: 'Pages on performance-based evaluation' },
      { value: 'SNI', label: 'Written for Indonesian practice' },
    ],
    links: books.map((b, i) => ({ label: i === 0 ? 'Evaluasi' : 'Perancangan', href: b.href })),
    glyph: 'books',
  },
];

export const memoryIds = memories.map(m => m.id);
