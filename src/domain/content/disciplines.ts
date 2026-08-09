export interface DisciplineOption {
  label: string;
  value: string;
}

export interface DisciplineGroup {
  group: string;
  disciplines: DisciplineOption[];
}

export const DISCIPLINARY_GROUPS: DisciplineGroup[] = [
  {
    group: '1. Формальні науки (Formal Sciences)',
    disciplines: [
      { label: 'Логіка (Logic)', value: 'logic' },
      { label: 'Математика (Mathematics)', value: 'mathematics' },
      { label: 'Теорія чисел (Number Theory)', value: 'number_theory' },
      { label: 'Теорія інформації (Information Theory)', value: 'information_theory' },
    ],
  },
  {
    group: '2. Природничі науки (Natural Sciences)',
    disciplines: [
      { label: 'Фізика (Physics)', value: 'physics' },
      { label: 'Механіка (Mechanics)', value: 'mechanics' },
      { label: 'Оптика і фотоніка (Optics & Photonics)', value: 'optics_photonics' },
      { label: 'Астрономія (Astronomy)', value: 'astronomy' },
      { label: 'Астрофізика (Astrophysics)', value: 'astrophysics' },
      { label: 'Космологія (Cosmology)', value: 'cosmology' },
      { label: 'Планетологія (Planetology)', value: 'planetology' },
      { label: 'Хімія (Chemistry)', value: 'chemistry' },
      { label: 'Генетика (Genetics)', value: 'genetics' },
      { label: 'Біологія (Biology)', value: 'biology' },
      { label: 'Еволюційна біологія (Evolutionary Biology)', value: 'evolutionary_biology' },
      { label: 'Нейробіологія (Neuroscience)', value: 'neuroscience' },
      { label: 'Екологія (Ecology)', value: 'ecology' },
      { label: 'Науки про Землю (Earth Sciences)', value: 'earth_sciences' },
      { label: 'Сейсмологія (Seismology)', value: 'seismology' },
      { label: 'Вулканологія (Volcanology)', value: 'volcanology' },
      { label: 'Метеорологія (Meteorology)', value: 'meteorology' },
    ],
  },
  {
    group: '3. Суспільні науки (Social Sciences)',
    disciplines: [
      { label: 'Соціологія (Sociology)', value: 'sociology' },
      { label: 'Антропологія (Anthropology)', value: 'anthropology' },
      { label: 'Археологія (Суспільна) (Archaeology - Social)', value: 'archaeology_social' },
      { label: 'Економіка (Economics)', value: 'economics' },
      { label: 'Політологія (Political Science)', value: 'political_science' },
      { label: 'Психологія (Psychology)', value: 'psychology' },
      { label: 'Демографія (Demography)', value: 'demography' },
      { label: 'Географія (Geography)', value: 'geography' },
      { label: 'Медіадослідження (Media Studies)', value: 'media_studies' },
      { label: 'Лінгвістика (Linguistics)', value: 'linguistics' },
      { label: 'Гендерні студії (Gender Studies)', value: 'gender_studies' },
      { label: 'Науки про спорт (Sports Science)', value: 'sports_science' },
      { label: 'Економічна історія (Economic History)', value: 'economic_history' },
    ],
  },
  {
    group: '4. Гуманітарні науки (Humanities)',
    disciplines: [
      { label: 'Історія (History)', value: 'history' },
      { label: 'Філософія (Philosophy)', value: 'philosophy' },
      { label: 'Богослов’я/Теологія (Theology)', value: 'theology' },
      { label: 'Релігієзнавство (Religious Studies)', value: 'religious_studies' },
      { label: 'Філологія (Philology)', value: 'philology' },
      { label: 'Література (Literature)', value: 'literature' },
      { label: 'Текстологія (Textual Studies)', value: 'textual_studies' },
      { label: 'Риторика (Rhetoric)', value: 'rhetoric' },
      { label: 'Культурологія (Cultural Studies)', value: 'cultural_studies' },
      { label: 'Мистецтвознавство (Art History)', value: 'art_history' },
      { label: 'Музикознавство (Musicology)', value: 'musicology' },
      { label: 'Кіно- та медіадослідження (Film & Media)', value: 'film_media_studies' },
      { label: 'Герменевтика (Hermeneutics)', value: 'hermeneutics' },
      { label: 'Етика (Ethics)', value: 'ethics' },
      { label: 'Естетика (Aesthetics)', value: 'aesthetics' },
      { label: 'Історія науки і техніки (History of Science)', value: 'history_of_science' },
      { label: 'Регіональні дослідження (Area Studies)', value: 'area_studies' },
      { label: 'Археологія (Гуманітарна) (Archaeology - Humanities)', value: 'archaeology_humanities' },
      { label: 'Релігійна філологія (Religious Philology)', value: 'religious_philology' },
    ],
  },
];

export const DISCIPLINE_MAP = Object.fromEntries(
  DISCIPLINARY_GROUPS.flatMap((group) =>
    group.disciplines.map((discipline) => [discipline.value, discipline.label]),
  ),
) as Record<string, string>;
