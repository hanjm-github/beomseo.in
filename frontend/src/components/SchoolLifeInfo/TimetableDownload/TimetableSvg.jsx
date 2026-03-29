import { forwardRef } from 'react';
import timetableTemplates from './timetableTemplates.json';
import {
  SUBJECT_FONT_FAMILY,
  emuToViewBoxX,
  emuToViewBoxY,
  fitElectiveText,
  fitTextToWidth,
  formatPeriodText,
  getRenderedCellContent,
  halfPointsToPx,
} from './timetableUtils';
import styles from './timetable.module.css';

const { meta, shared } = timetableTemplates;
const FOOTER_LABEL = '범서고 17대 학생회 학생지원부 & 정보기술부';

function getTextAnchor(align) {
  if (align === 'l') return 'start';
  if (align === 'r') return 'end';
  return 'middle';
}

function buildColumnOffsets(columns) {
  const offsets = [0];
  columns.forEach((width) => {
    offsets.push(offsets[offsets.length - 1] + emuToViewBoxX(width));
  });
  return offsets;
}

function buildRowOffsets(rows) {
  const offsets = [0];
  rows.forEach((height) => {
    offsets.push(offsets[offsets.length - 1] + emuToViewBoxY(height));
  });
  return offsets;
}

function renderPeriodCell(text, centerX, centerY, cellWidth, cellHeight, baseFontSize) {
  const [label, time] = formatPeriodText(text);
  const labelFit = fitTextToWidth({
    text: label,
    maxWidth: cellWidth - 12,
    baseFontSize: baseFontSize * 1.14,
    minFontSize: 14,
    maxFontSize: Math.max(baseFontSize * 1.55, cellHeight * 0.36),
  });
  const timeFit = fitTextToWidth({
    text: time,
    maxWidth: cellWidth - 12,
    baseFontSize: baseFontSize,
    minFontSize: 12,
    maxFontSize: Math.max(baseFontSize * 1.25, cellHeight * 0.3),
  });

  return (
    <text
      x={centerX}
      y={centerY}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#111111"
      fontFamily={SUBJECT_FONT_FAMILY}
      fontWeight="400"
    >
      <tspan x={centerX} dy={`-${label && time ? 0.62 : 0}em`} fontSize={labelFit.fontSize}>
        {label}
      </tspan>
      {time ? (
        <tspan x={centerX} dy="1.16em" fontSize={timeFit.fontSize}>
          {time}
        </tspan>
      ) : null}
    </text>
  );
}

function renderElectiveCell({ lines, x, y, width, height, cell, textAnchor }) {
  const subject = lines[0] ?? '';
  const room = lines[1] ?? '';
  const centerX = x + width / 2;
  const subjectFit = fitElectiveText({
    subject,
    room,
    maxWidth: width - 16,
    baseFontSize: halfPointsToPx(cell.fontSizeHalfPoints),
    cellHeight: height,
  });

  if (!room) {
    return (
      <text
        x={centerX}
        y={y + height / 2}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={cell.textColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.subjectFontSize}
        fontWeight="400"
      >
        {subject}
      </text>
    );
  }

  return (
    <>
      <text
        x={centerX}
        y={y + height * 0.36}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={cell.textColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.subjectFontSize}
        fontWeight="400"
      >
        {subject}
      </text>
      <text
        x={centerX}
        y={y + height * 0.74}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={cell.textColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.roomFontSize}
        fontWeight="400"
      >
        {room}
      </text>
    </>
  );
}

const TimetableSvg = forwardRef(function TimetableSvg({ template, draftValues, grade }, ref) {
  if (!template) return null;

  const tableX = emuToViewBoxX(shared.table.xEmu);
  const tableY = emuToViewBoxY(shared.table.yEmu);
  const columnOffsets = buildColumnOffsets(shared.table.columnsEmu);
  const rowOffsets = buildRowOffsets(shared.table.rowsEmu);
  const borderWidth = Math.max(1, emuToViewBoxX(shared.table.border.widthEmu));

  return (
    <svg
      ref={ref}
      className={styles.previewSvg}
      viewBox={`0 0 ${meta.viewBoxWidth} ${meta.viewBoxHeight}`}
      role="img"
      aria-label={`${template.classId} 시간표`}
    >
      <title>{`${template.classId} 시간표`}</title>
      <rect width={meta.viewBoxWidth} height={meta.viewBoxHeight} fill="#FFFFFF" />

      {template.cells.map((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const x = tableX + columnOffsets[columnIndex];
          const y = tableY + rowOffsets[rowIndex];
          const width = columnOffsets[columnIndex + 1] - columnOffsets[columnIndex];
          const height = rowOffsets[rowIndex + 1] - rowOffsets[rowIndex];
          const renderedContent = getRenderedCellContent(cell.text, draftValues, grade);
          const fittedFont = fitTextToWidth({
            text: renderedContent.text,
            maxWidth: width - 14,
            baseFontSize: halfPointsToPx(cell.fontSizeHalfPoints),
            maxFontSize: Math.max(halfPointsToPx(cell.fontSizeHalfPoints), height * 0.48),
          });
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          const textAnchor = getTextAnchor(cell.align);
          const textX =
            textAnchor === 'start' ? x + 10 : textAnchor === 'end' ? x + width - 10 : centerX;

          return (
            <g key={`${rowIndex}-${columnIndex}`}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={cell.fill}
                stroke={shared.table.border.color}
                strokeWidth={borderWidth}
              />

              {cell.text ? (
                columnIndex === 0 && rowIndex > 0 ? (
                  renderPeriodCell(
                    renderedContent.text,
                    centerX,
                    centerY,
                    width,
                    height,
                    halfPointsToPx(cell.fontSizeHalfPoints)
                  )
                ) : renderedContent.isPlaceholder ? (
                  renderElectiveCell({
                    lines: renderedContent.lines,
                    x,
                    y,
                    width,
                    height,
                    cell,
                    textAnchor,
                  })
                ) : (
                  <text
                    x={textX}
                    y={centerY}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill={cell.textColor}
                    fontFamily={SUBJECT_FONT_FAMILY}
                    fontSize={fittedFont.fontSize}
                    fontWeight="400"
                  >
                    {renderedContent.text}
                  </text>
                )
              ) : null}
            </g>
          );
        })
      )}

      <text
        x={emuToViewBoxX(shared.classLabel.xEmu + shared.classLabel.widthEmu / 2)}
        y={emuToViewBoxY(shared.classLabel.yEmu + shared.classLabel.heightEmu / 2)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={shared.classLabel.textColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={fitTextToWidth({
          text: template.classId,
          maxWidth: emuToViewBoxX(shared.classLabel.widthEmu) - 12,
          baseFontSize: halfPointsToPx(shared.classLabel.fontSizeHalfPoints),
          maxFontSize: emuToViewBoxY(shared.classLabel.heightEmu) * 0.82,
        }).fontSize}
        fontWeight="400"
      >
        {template.classId}
      </text>

      {shared.schoolName ? (
        <text
          x={tableX}
          y={emuToViewBoxY(shared.schoolName.yEmu + shared.schoolName.heightEmu / 2)}
          textAnchor="start"
          dominantBaseline="middle"
          fill={shared.schoolName.textColor}
          fontFamily={SUBJECT_FONT_FAMILY}
          fontSize={fitTextToWidth({
            text: FOOTER_LABEL,
            maxWidth: emuToViewBoxX(shared.table.widthEmu) - 12,
            baseFontSize: halfPointsToPx(shared.schoolName.fontSizeHalfPoints),
            maxFontSize: emuToViewBoxY(shared.schoolName.heightEmu) * 0.9,
            minFontSize: 10,
          }).fontSize}
          fontWeight="400"
        >
          {FOOTER_LABEL}
        </text>
      ) : null}
    </svg>
  );
});

export default TimetableSvg;
