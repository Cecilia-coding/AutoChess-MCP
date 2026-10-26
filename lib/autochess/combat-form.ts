export const FORM_STATS = ['atk','aspd','armor','mr','range'] as const;
export type FormStat = typeof FORM_STATS[number];
export type FormPanel = Record<FormStat,number> & {name:string;traits:string[]};
export type TemporaryForm = {into:string;until:number;original:FormPanel};
type FormSubject = FormPanel & {temporaryForm?:TemporaryForm};

export function isFormStat(stat:string):stat is FormStat {
  return (FORM_STATS as readonly string[]).includes(stat);
}

/** Keep the underlying star/equipment panel current while its appearance is replaced. */
export function changeFormStat(subject:FormSubject,stat:FormStat,change:(value:number)=>number) {
  subject[stat]=change(subject[stat]);
  if(subject.temporaryForm)subject.temporaryForm.original[stat]=change(subject.temporaryForm.original[stat]);
}

export function applyCombatForm(subject:FormSubject,into:string,panel:FormPanel,until?:number) {
  const current=subject.temporaryForm;
  if(until!==undefined) {
    if(current?.into===into) {current.until=Math.max(current.until,until);return;}
    const original=current?.original??{
      name:subject.name,traits:[...subject.traits],
      atk:subject.atk,aspd:subject.aspd,armor:subject.armor,mr:subject.mr,range:subject.range,
    };
    subject.temporaryForm={into,until:Math.max(current?.until??0,until),original};
    Object.assign(subject,panel,{traits:[...panel.traits]});
  } else if(current) {
    // A permanent self-form (e.g. a passive transformation) survives the temporary disguise.
    current.original={...panel,traits:[...panel.traits]};
  } else Object.assign(subject,panel,{traits:[...panel.traits]});
}

export function expireCombatForm(subject:FormSubject,timeMs:number):boolean {
  const form=subject.temporaryForm;
  if(!form||timeMs<form.until)return false;
  Object.assign(subject,form.original,{traits:[...form.original.traits]});
  delete subject.temporaryForm;
  return true;
}
