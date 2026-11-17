// Every rule in the engine cites one or more of these. Links go to PubMed
// searches for the exact title so they stay valid even if a DOI changes.

export interface Source {
  id: string;
  short: string;
  citation: string;
  claim: string;
  url: string;
}

const pubmed = (title: string) =>
  `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title)}`;

export const SOURCES: Record<string, Source> = {
  schoenfeld2016freq: {
    id: "schoenfeld2016freq",
    short: "Schoenfeld 2016",
    citation:
      "Schoenfeld BJ, Ogborn D, Krieger JW. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. Sports Med. 2016.",
    claim: "Training each muscle about twice a week beats once a week for growth.",
    url: pubmed("Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy"),
  },
  schoenfeld2017volume: {
    id: "schoenfeld2017volume",
    short: "Schoenfeld 2017",
    citation:
      "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci. 2017.",
    claim: "Roughly 10+ hard sets per muscle per week produce more growth than fewer.",
    url: pubmed("Dose-response relationship between weekly resistance training volume and increases in muscle mass"),
  },
  bickel2011: {
    id: "bickel2011",
    short: "Bickel 2011",
    citation:
      "Bickel CS, Cross JM, Bamman MM. Exercise dosing to retain resistance training adaptations in young and older adults. Med Sci Sports Exerc. 2011.",
    claim: "Muscle size is maintained on about one third of the original training volume.",
    url: pubmed("Exercise dosing to retain resistance training adaptations in young and older adults"),
  },
  acsm2009: {
    id: "acsm2009",
    short: "ACSM 2009",
    citation:
      "American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009.",
    claim: "Allow ~48 h before training the same muscle hard again; progress load gradually (about 2-10%).",
    url: pubmed("American College of Sports Medicine position stand. Progression models in resistance training for healthy adults"),
  },
  schoenfeld2021reps: {
    id: "schoenfeld2021reps",
    short: "Schoenfeld 2021",
    citation:
      "Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum. Sports. 2021.",
    claim: "Hypertrophy occurs across a wide rep range when sets go near failure; moderate ranges are most time-efficient.",
    url: pubmed("Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum"),
  },
  helms2016rpe: {
    id: "helms2016rpe",
    short: "Helms 2016",
    citation:
      "Helms ER, Cronin J, Storey A, Zourdos MC. Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training. Strength Cond J. 2016.",
    claim: "RPE / reps-in-reserve lets load progress based on how hard sets actually were.",
    url: pubmed("Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training"),
  },
  greig2020autoreg: {
    id: "greig2020autoreg",
    short: "Greig 2020",
    citation:
      "Greig L, Stephens Hemingway BH, Aspe RR, et al. Autoregulation in Resistance Training: Addressing the Inconsistencies. Sports Med. 2020.",
    claim: "Adjusting training to daily readiness (autoregulation) is a reasonable way to manage fatigue.",
    url: pubmed("Autoregulation in Resistance Training: Addressing the Inconsistencies"),
  },
  bell2023deload: {
    id: "bell2023deload",
    short: "Bell 2023",
    citation:
      "Bell L, Nolan D, Immonen V, et al. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. Sports Med Open. 2023.",
    claim: "Deloads (reduced volume/intensity for about a week) are used to dissipate fatigue and break plateaus.",
    url: pubmed("Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach"),
  },
  mifflin1990: {
    id: "mifflin1990",
    short: "Mifflin 1990",
    citation:
      "Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990.",
    claim: "Mifflin-St Jeor equation for resting energy expenditure.",
    url: pubmed("A new predictive equation for resting energy expenditure in healthy individuals"),
  },
  ainsworth2011: {
    id: "ainsworth2011",
    short: "Compendium 2011",
    citation:
      "Ainsworth BE, Haskell WL, Herrmann SD, et al. 2011 Compendium of Physical Activities: a second update of codes and MET values. Med Sci Sports Exerc. 2011.",
    claim: "MET values used to estimate the energy cost of lifting and circuit sessions.",
    url: pubmed("2011 Compendium of Physical Activities: a second update of codes and MET values"),
  },
  iraki2019: {
    id: "iraki2019",
    short: "Iraki 2019",
    citation:
      "Iraki J, Fitschen P, Espinar S, Helms E. Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review. Sports. 2019.",
    claim: "Lean gaining: small surplus targeting ~0.25-0.5% of bodyweight gained per week.",
    url: pubmed("Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review"),
  },
  morton2018protein: {
    id: "morton2018protein",
    short: "Morton 2018",
    citation:
      "Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. Br J Sports Med. 2018.",
    claim: "Benefits of protein plateau around 1.6 g/kg/day (upper confidence bound ~2.2).",
    url: pubmed("A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains"),
  },
  issn2017protein: {
    id: "issn2017protein",
    short: "ISSN 2017",
    citation:
      "Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017.",
    claim: "1.4-2.0 g/kg/day protein, spread across meals, for exercising individuals.",
    url: pubmed("International Society of Sports Nutrition Position Stand: protein and exercise"),
  },
  tanaka2001: {
    id: "tanaka2001",
    short: "Tanaka 2001",
    citation:
      "Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol. 2001.",
    claim: "Max HR ≈ 208 − 0.7 × age.",
    url: pubmed("Age-predicted maximal heart rate revisited"),
  },
  who2020: {
    id: "who2020",
    short: "WHO 2020",
    citation:
      "Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020.",
    claim: "Adults: 150-300 min moderate or 75-150 min vigorous aerobic activity per week, plus strength work.",
    url: pubmed("World Health Organization 2020 guidelines on physical activity and sedentary behaviour"),
  },
};

export function sourcesFor(ids: Iterable<string>): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const id of ids) {
    if (seen.has(id) || !SOURCES[id]) continue;
    seen.add(id);
    out.push(SOURCES[id]);
  }
  return out;
}
