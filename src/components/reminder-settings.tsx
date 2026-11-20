import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAlerts } from '@/lib/alerts';
import { giveFeedback } from '@/lib/feedback';
import { EXPIRY_DAYS_RANGE, FREEZER_MONTHS_RANGE, getReminderPrefs, setReminderPref } from '@/lib/reminder-prefs';
import { Button, Hint, ModalCard, Stepper } from '@/ui/components';
import { colors, font, spacing } from '@/ui/theme';

/**
 * Reminder delays (opened from the Péremption tab header). They drive everything:
 * notifications, the "expiring soon" / "frozen for a long time" lists, badges,
 * home banner and "Ignorer". Applied on "Enregistrer".
 */
export function ReminderSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { refresh } = useAlerts();
  const [draft, setDraft] = useState(getReminderPrefs);
  // Starts from the saved values on every open (adjusted during render, no effect)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(getReminderPrefs());
  }

  const save = () => {
    setReminderPref('expiryDays', draft.expiryDays);
    setReminderPref('freezerMonths', draft.freezerMonths);
    // Recomputes the shared alerts (banner, badges) and reschedules the notifications
    refresh();
    giveFeedback('success');
    onClose();
  };

  return (
    <ModalCard
      visible={visible}
      title="Quand m’alerter ?"
      subtitle={
        'Ces délais décident de ce qui apparaît dans cet onglet (et sur l’accueil) et du moment où tu reçois une notification.\nIls valent pour tous les produits.'
      }
      onClose={onClose}>
      <View>
        <StepperRow
          label="Péremption proche"
          detail={`Listé ici et notifié ${draft.expiryDays === 1 ? 'la veille' : `${draft.expiryDays} jours avant`}`}
          value={draft.expiryDays}
          display={(d) => (d === 1 ? 'La veille' : `${d} j avant`)}
          spoken={(d) => (d === 1 ? 'la veille' : `${d} jours avant`)}
          range={EXPIRY_DAYS_RANGE}
          onChange={(v) => setDraft((p) => ({ ...p, expiryDays: v }))}
        />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <StepperRow
          label="Congélateur"
          detail={`Listé ici et notifié après ${draft.freezerMonths} mois`}
          value={draft.freezerMonths}
          display={(m) => `${m} mois`}
          spoken={(m) => `${m} mois`}
          range={FREEZER_MONTHS_RANGE}
          onChange={(v) => setDraft((p) => ({ ...p, freezerMonths: v }))}
        />
      </View>
      <Hint>Les notifications s’activent dans Réglages › Rappels.</Hint>
      <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.md }}>
        <Button title="Annuler" variant="ghost" feedback="close" onPress={onClose} />
        <Button title="Enregistrer" feedback={false} onPress={save} />
      </View>
    </ModalCard>
  );
}

function StepperRow({
  label,
  detail,
  value,
  display,
  spoken,
  range,
  onChange,
}: {
  label: string;
  detail: string;
  value: number;
  display: (value: number) => string;
  spoken: (value: number) => string;
  range: { min: number; max: number };
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={font.bodyStrong}>{label}</Text>
        <Hint>{detail}</Hint>
      </View>
      <Stepper
        value={display(value)}
        valueLabel={`${label} : ${spoken(value)}`}
        valueWidth={76}
        decreaseLabel={`${label} : moins`}
        increaseLabel={`${label} : plus`}
        atMin={value <= range.min}
        atMax={value >= range.max}
        repeat={false}
        onStep={(d) => onChange(value + d)}
        style={{ gap: spacing.sm }}
      />
    </View>
  );
}
