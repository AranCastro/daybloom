'use no memo';
/**
 * Draws a home-screen widget tree (FlexWidget / TextWidget / SvgWidget) with ordinary
 * React Native views, so the Widgets screen can preview the real widgets on any platform.
 * Follows Android LinearLayout rules: children keep their own size unless they ask for
 * "match_parent" or a flex weight.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Children, isValidElement, ReactElement, ReactNode } from 'react';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

type Click = (action: string, data: Record<string, unknown>) => void;
type AnyProps = Record<string, any>;

function gradientPoints(o: string): { start: { x: number; y: number }; end: { x: number; y: number } } {
  switch (o) {
    case 'LEFT_RIGHT':
      return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
    case 'TOP_BOTTOM':
      return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
    default:
      return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  }
}

function size(v: unknown, parentRow: boolean, axis: 'width' | 'height'): ViewStyle {
  if (v === 'match_parent') {
    // Along the parent's main axis, match_parent takes the remaining space.
    const main = (parentRow && axis === 'width') || (!parentRow && axis === 'height');
    return main ? { flexGrow: 1, flexShrink: 1 } : { alignSelf: 'stretch' };
  }
  if (typeof v === 'number') return { [axis]: v };
  return {};
}

function box(style: AnyProps, parentRow: boolean): ViewStyle {
  const st: ViewStyle = {};
  const keys = [
    'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'borderRadius', 'borderWidth', 'borderColor', 'backgroundColor',
  ];
  for (const k of keys) if (style[k] !== undefined) (st as AnyProps)[k] = style[k];
  Object.assign(st, size(style.width, parentRow, 'width'), size(style.height, parentRow, 'height'));
  if (style.flex) Object.assign(st, { flexGrow: style.flex, flexShrink: 1, flexBasis: 0, minWidth: 0 });
  return st;
}

function flexChildren(el: ReactElement<AnyProps>): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(el.props.children, (c) => {
    if (c) out.push(c);
  });
  return out;
}

function Node({ el, parentRow, onClick }: { el: ReactNode; parentRow: boolean; onClick?: Click }): ReactNode {
  if (!isValidElement(el)) return null;
  const type = el.type as AnyProps;
  const props = el.props as AnyProps;
  const name: string | undefined = type.__name__;
  // Plain components (e.g. <Shell>) are just called, as the native builder does.
  if (!name) return <Node el={(type as (p: AnyProps) => ReactNode)(props)} parentRow={parentRow} onClick={onClick} />;

  const style: AnyProps = props.style ?? {};
  const click = props.clickAction && onClick ? () => onClick(props.clickAction, props.clickActionData ?? {}) : undefined;

  const a11y = click ? { onPress: click, accessibilityRole: 'button' as const, accessibilityLabel: props.accessibilityLabel } : {};

  if (name === 'TextWidget') {
    const t: TextStyle = {
      fontSize: style.fontSize ?? 12,
      fontFamily: style.fontFamily,
      color: style.color,
      letterSpacing: style.letterSpacing ? style.letterSpacing * (style.fontSize ?? 12) : undefined,
      textAlign: style.textAlign,
      includeFontPadding: false,
    };
    return (
      <Text {...a11y} numberOfLines={props.maxLines} ellipsizeMode="tail" style={[t, box(style, parentRow)]}>
        {props.text}
      </Text>
    );
  }

  const Box = click ? Pressable : View;

  if (name === 'SvgWidget') {
    return (
      <Box {...a11y} style={box(style, parentRow)}>
        <SvgXml xml={props.svg} width={style.width} height={style.height} />
      </Box>
    );
  }

  const row = style.flexDirection === 'row';
  const layout: ViewStyle = {
    flexDirection: row ? 'row' : 'column',
    alignItems: style.alignItems ?? 'flex-start',
    justifyContent: style.justifyContent ?? 'flex-start',
    overflow: 'hidden',
  };
  const g = style.backgroundGradient;
  return (
    <Box {...a11y} style={[box(style, parentRow), layout]}>
      {g && (
        <LinearGradient
          colors={[g.from, g.to]}
          {...gradientPoints(g.orientation)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {flexChildren(el as ReactElement<AnyProps>).map((c, i) => (
        <Node key={i} el={c} parentRow={row} onClick={onClick} />
      ))}
    </Box>
  );
}

export function WidgetMock({ tree, width, height, onClick }: { tree: ReactElement; width: number; height: number; onClick?: Click }) {
  return (
    <View style={{ width, height, flexDirection: 'column' }}>
      <Node el={tree} parentRow={false} onClick={onClick} />
    </View>
  );
}
