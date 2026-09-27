/**
 * Where you feel best: the user's places ranked by average mood, and a small map of the pinned
 * ones (WGS 84 coordinates, drawn with a local equirectangular projection; north is up).
 * Nothing leaves the phone: there are no map tiles, only the user's own points.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { AddPlace } from '@/components/place-picker';
import { Text } from '@/components/text';
import { Card, Choice, Screen, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { addDays, fromKey, dayKey } from '@/lib/dates';
import { tagOf } from '@/lib/mood-tags';
import { moodOf } from '@/lib/moods';
import { currentCoords, PlaceStats, placeStats } from '@/lib/places';
import { deletePlace, updatePlace, useAppState } from '@/lib/store';

export default function PlacesScreen() {
  const t = useTheme();
  const today = useToday();
  const state = useAppState((s) => s);
  const [range, setRange] = useState<'month' | 'all'>('month');
  const [adding, setAdding] = useState(false);
  const since = range === 'month' ? dayKey(addDays(fromKey(today), -29)) : undefined;
  const stats = placeStats(state, since);
  const withDays = stats.filter((x) => x.days > 0);
  const best = withDays[0];

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 4 }}>
        <Text variant="label">Your places</Text>
        <Text variant="title">Where you feel best.</Text>
        <Text variant="small">From the places you tag on your check-ins. Everything stays on this phone.</Text>
      </Animated.View>

      <Choice
        options={[
          { label: 'Last 30 days', value: 'month' },
          { label: 'All time', value: 'all' },
        ]}
        value={range}
        onChange={setRange}
      />

      {best && best.avg !== null && (
        <Card tone="accent">
          <Text variant="label">Your brightest place</Text>
          <Text variant="title">
            {best.place.emoji} {best.place.name}
          </Text>
          <Text variant="small">
            Average mood {moodOf(Math.round(best.avg))?.label ?? ''} over {best.days} {best.days === 1 ? 'day' : 'days'}
            {best.top ? ` · often ${tagOf(best.top)?.label.toLowerCase()}` : ''}.
          </Text>
        </Card>
      )}

      <PlaceMap stats={stats} />

      <Card>
        <Text variant="label">All places</Text>
        {stats.length === 0 && <Text variant="small">No places yet. Add one below, or from Today after you check in.</Text>}
        {stats.map((x) => (
          <PlaceRow key={x.place.id} x={x} />
        ))}
        <Pressable onPress={() => (tap(), setAdding(true))} accessibilityRole="button" style={styles.add}>
          <Icon name="plus" color={t.accentText} size={18} />
          <Text variant="bodyStrong" style={{ color: t.accentText }}>
            Add a place
          </Text>
        </Pressable>
      </Card>
      {adding && <AddPlace onClose={() => setAdding(false)} />}
    </Screen>
  );
}

function PlaceRow({ x }: { x: PlaceStats }) {
  const t = useTheme();
  const mood = x.avg !== null ? moodOf(Math.round(x.avg)) : undefined;
  const pinned = x.place.lat !== undefined;

  async function pin() {
    const here = await currentCoords(true);
    if (here) updatePlace(x.place.id, { lat: here.lat, lon: here.lon });
  }

  function remove() {
    const go = () => deletePlace(x.place.id);
    const msg = `Remove ${x.place.name}? Check-ins keep their moods; only the place tag goes.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(msg)) go();
      return;
    }
    Alert.alert('Remove place?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <View style={[styles.row, { borderColor: t.line }]}>
      <Text style={{ fontSize: 24 }}>{x.place.emoji}</Text>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong">{x.place.name}</Text>
        <Text variant="small" style={{ fontSize: 12 }}>
          {x.days ? `${x.days} ${x.days === 1 ? 'day' : 'days'} · ${x.best} good` : 'No check-ins here yet'}
          {x.top ? ` · ${tagOf(x.top)?.emoji} ${tagOf(x.top)?.label}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
          {!pinned && (
            <Pressable onPress={pin} hitSlop={6} accessibilityRole="button">
              <Text variant="small" color="accent" style={{ fontSize: 12 }}>
                Pin with GPS
              </Text>
            </Pressable>
          )}
          <Pressable onPress={remove} hitSlop={6} accessibilityRole="button">
            <Text variant="small" style={{ fontSize: 12, color: t.textMuted }}>
              Remove
            </Text>
          </Pressable>
        </View>
      </View>
      {mood ? <MoodOrb mood={mood} size={34} face={false} /> : <View style={{ width: 34 }} />}
    </View>
  );
}

/** Pinned places on a plain map: circle size = days checked in there, colour = average mood. */
function PlaceMap({ stats }: { stats: PlaceStats[] }) {
  const t = useTheme();
  const dark = useIsDark();
  const { width: screen } = useWindowDimensions();
  const W = Math.min(screen, 520) - 32 - 40;
  const H = Math.round(W * 0.72);
  const pts = stats.filter((x) => x.place.lat !== undefined && x.place.lon !== undefined);

  if (!pts.length) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="map" color={t.textSecondary} size={22} />
          <Text variant="small" style={{ flex: 1 }}>
            Pin a place with GPS to see it on your map. Places without a pin still count in the list below.
          </Text>
        </View>
      </Card>
    );
  }

  // Local equirectangular projection around the points, padded, at least about 2 km across.
  const lats = pts.map((x) => x.place.lat!);
  const lons = pts.map((x) => x.place.lon!);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 0.018);
  const spanX = Math.max((Math.max(...lons) - Math.min(...lons)) * k, 0.018);
  const scale = Math.min((W - 90) / spanX, (H - 110) / spanY); // px per degree of latitude
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
  const project = (lat: number, lon: number) => ({ x: W / 2 + (lon - cx) * k * scale, y: H / 2 + 6 - (lat - lat0) * scale });

  // Scale bar: a round number of km close to a quarter of the width.
  const kmPerPx = 111.32 / scale;
  const target = (W / 4) * kmPerPx;
  const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((n) => n >= target) ?? target;
  const barPx = nice / kmPerPx;

  const land = dark ? '#1E2A24' : '#EEF3E6';
  const grid = dark ? '#2C3A33' : '#DCE6D2';
  return (
    <Card>
      <Text variant="label">Your map</Text>
      <View style={{ alignItems: 'center' }}>
        <Svg width={W} height={H}>
          <Rect x={0} y={0} width={W} height={H} rx={18} fill={land} />
          {Array.from({ length: 5 }, (_, i) => (
            <G key={i}>
              <Line x1={(W / 5) * i + W / 10} y1={0} x2={(W / 5) * i + W / 10} y2={H} stroke={grid} strokeWidth={1} />
              <Line x1={0} y1={(H / 4) * i + H / 8} x2={W} y2={(H / 4) * i + H / 8} stroke={grid} strokeWidth={1} />
            </G>
          ))}
          {pts.map((x) => {
            const { x: px, y: py } = project(x.place.lat!, x.place.lon!);
            const r = 10 + 4 * Math.sqrt(x.days);
            const mood = x.avg !== null ? moodOf(Math.round(x.avg)) : undefined;
            return (
              <G key={x.place.id}>
                <Circle cx={px} cy={py} r={r + 4} fill={mood ? mood.colors[1] : t.textMuted} opacity={0.25} />
                <Circle cx={px} cy={py} r={r} fill={mood ? mood.colors[1] : t.surfaceAlt} stroke={dark ? '#0008' : '#fff'} strokeWidth={2} />
                <SvgText x={px} y={py + 5} fontSize={14} textAnchor="middle">
                  {x.place.emoji}
                </SvgText>
                <SvgText x={px} y={py + r + 16} fontSize={12} fontFamily={Fonts.bodyStrong} fill={t.text} textAnchor="middle">
                  {x.place.name}
                </SvgText>
              </G>
            );
          })}
          {/* North arrow */}
          <G transform={`translate(${W - 26} 16)`}>
            <Path d="M0 18 L6 0 L12 18 L6 13 Z" fill={t.text} />
            <SvgText x={6} y={32} fontSize={10} fontFamily={Fonts.bodyStrong} fill={t.text} textAnchor="middle">
              N
            </SvgText>
          </G>
          {/* Scale bar */}
          <G transform={`translate(14 26)`}>
            <Line x1={0} y1={0} x2={barPx} y2={0} stroke={t.text} strokeWidth={2} />
            <Line x1={0} y1={-4} x2={0} y2={4} stroke={t.text} strokeWidth={2} />
            <Line x1={barPx} y1={-4} x2={barPx} y2={4} stroke={t.text} strokeWidth={2} />
            <SvgText x={barPx / 2} y={-6} fontSize={10} fontFamily={Fonts.bodyStrong} fill={t.text} textAnchor="middle">
              {nice < 1 ? `${nice * 1000} m` : `${nice} km`}
            </SvgText>
          </G>
        </Svg>
      </View>
      <Text variant="small" style={{ fontSize: 11.5 }}>
        Circle size: days checked in there. Colour: average mood. WGS 84 (EPSG:4326), drawn with a local equirectangular
        projection; north is up.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 },
});
