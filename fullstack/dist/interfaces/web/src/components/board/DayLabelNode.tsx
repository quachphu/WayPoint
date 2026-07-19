import { memo } from 'react';

// A plain, non-interactive label marking the start of a day's swimlane on the
// board. Pans/zooms with the canvas like any other node since it's a real RF
// node — no separate overlay layer to keep in sync.
export const DayLabelNode = memo(({ data }: any) => {
  return (
    <div className="wp-day-label no-select">
      <span className="wp-day-label__text">{data.label}</span>
    </div>
  );
});
