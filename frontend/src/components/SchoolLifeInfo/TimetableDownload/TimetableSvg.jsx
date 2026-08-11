import { forwardRef } from 'react';
import timetableTemplates from './timetableTemplates.json';
import {
  SUBJECT_FONT_FAMILY,
  LABEL_FONT_FAMILY,
  emuToViewBoxX,
  emuToViewBoxY,
  fitElectiveText,
  fitTextToWidth,
  formatPeriodText,
  getRenderedCellContent,
  halfPointsToPx,
} from './timetableUtils';
import { applyTheme } from './timetableTheme';
import styles from './timetable.module.css';

const { meta, shared } = timetableTemplates;
const FOOTER_LABEL = ' ☄️ 범서고 17대 학생회 정보기술부 ☄️';
const FOOTER_NOTICE_LABEL = '계획은 언제든지 변경될 수 있으며 선생님의 안내를 우선해주시기 바랍니다.';

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

function renderPeriodCell(text, centerX, centerY, cellWidth, cellHeight, baseFontSize, theme) {
  const [label] = formatPeriodText(text);
  const labelFit = fitTextToWidth({
    text: label,
    maxWidth: cellWidth - 8,
    baseFontSize: baseFontSize * 1.8,
    minFontSize: 16,
    maxFontSize: Math.max(baseFontSize * 2.2, cellHeight * 0.6),
  });

  return (
    <text
      x={centerX}
      y={centerY}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={theme.periodTextColor}
      fontFamily={SUBJECT_FONT_FAMILY}
      fontWeight="500"
      stroke={theme.periodStroke}
      strokeWidth="4"
      paintOrder="stroke"
      fontSize={labelFit.fontSize}
    >
      {label}
    </text>
  );
}

function renderElectiveCell({ lines, x, y, width, height, cell, textAnchor, theme }) {
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

  const themedTextColor = theme.textColor(cell.textColor);
  const themedStroke = theme.strokeColor(themedTextColor);

  if (!room) {
    return (
      <text
        x={centerX}
        y={y + height / 2}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={themedTextColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.subjectFontSize}
        fontWeight="500"
        stroke={themedStroke}
        strokeWidth="4"
        paintOrder="stroke"
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
        fill={themedTextColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.subjectFontSize}
        fontWeight="500"
        stroke={themedStroke}
        strokeWidth="4"
        paintOrder="stroke"
      >
        {subject}
      </text>
      <text
        x={centerX}
        y={y + height * 0.74}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={themedTextColor}
        fontFamily={SUBJECT_FONT_FAMILY}
        fontSize={subjectFit.roomFontSize}
        fontWeight="500"
        stroke={themedStroke}
        strokeWidth="4"
        paintOrder="stroke"
      >
        {room}
      </text>
    </>
  );
}

function renderMultilineCell({ text, x, y, width, height, cell, theme, textAnchor, isHeader }) {
  const lines = typeof text === 'string' ? text.split('\n') : [String(text)];
  const lineCount = lines.length;
  const availableWidth = width - 14;
  const availableHeight = height - 12;

  const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  const targetFontSizeHeight = Math.max(9, Math.min(16, (availableHeight / lineCount) * 0.84));

  const fontFit = fitTextToWidth({
    text: longestLine,
    maxWidth: availableWidth,
    baseFontSize: targetFontSizeHeight,
    minFontSize: 8.5,
    maxFontSize: targetFontSizeHeight,
  });

  const fontSize = fontFit.fontSize;
  const lineHeight = Math.max(fontSize * 1.15, availableHeight / lineCount);
  const totalTextHeight = (lineCount - 1) * lineHeight;
  const startY = y + (height - totalTextHeight) / 2;

  const themedTextColor = theme.textColor(cell.textColor);
  const themedStroke = theme.strokeColor(themedTextColor);

  const centerX = x + width / 2;
  const textX = textAnchor === 'start' ? x + 10 : textAnchor === 'end' ? x + width - 10 : centerX;

  return (
    <text
      x={textX}
      y={startY}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fill={themedTextColor}
      fontFamily={SUBJECT_FONT_FAMILY}
      fontSize={fontSize}
      fontWeight={isHeader ? '600' : '500'}
      stroke={themedStroke}
      strokeWidth="3"
      paintOrder="stroke"
    >
      {lines.map((line, idx) => (
        <tspan key={idx} x={textX} dy={idx === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

const TimetableSvg = forwardRef(function TimetableSvg(
  { template, draftValues, grade, backgroundUrl, bgOpacity, colorTheme = 'light' },
  ref
) {
  if (!template) return null;

  const isDark = colorTheme === 'dark';
  const theme = applyTheme(isDark);
  const hasBackground = Boolean(backgroundUrl);

  const viewBoxWidth = template.viewBoxWidth ?? meta.viewBoxWidth;
  const viewBoxHeight = template.viewBoxHeight ?? meta.viewBoxHeight;

  const tableX = emuToViewBoxX(shared.table.xEmu);
  const tableY = emuToViewBoxY(shared.table.yEmu);
  const tableWidth = emuToViewBoxX(shared.table.widthEmu);
  const columnOffsets = buildColumnOffsets(shared.table.columnsEmu);
  const rowOffsets = buildRowOffsets(template.rowsEmu ?? shared.table.rowsEmu);
  const borderWidth = Math.max(1, emuToViewBoxX(shared.table.border.widthEmu));

  const tableTotalHeight = rowOffsets[rowOffsets.length - 1];
  const footerY = tableY + tableTotalHeight + 35;

  return (
    <svg
      ref={ref}
      className={styles.previewSvg}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label={`${template.classId} 시간표`}
      data-color-theme={colorTheme}
    >
      <title>{`${template.classId} 시간표`}</title>

      {/* 전체 배경 */}
      <rect
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill={theme.slideBg}
      />

      {/* 배경 이미지 (항상 100% 선명) */}
      {hasBackground && (
        <image
          href={backgroundUrl}
          x="0"
          y="0"
          width={viewBoxWidth}
          height={viewBoxHeight}
          preserveAspectRatio="xMidYMid slice"
          opacity={1}
        />
      )}

      {/* 테이블 셀 */}
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

          const themedFill = theme.cellFill(cell.fill);
          const themedTextColor = theme.textColor(cell.textColor);
          const themedStroke = theme.strokeColor(themedTextColor);

          return (
            <g key={`${rowIndex}-${columnIndex}`}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={themedFill}
                fillOpacity={hasBackground ? bgOpacity : 1}
                stroke={theme.borderColor}
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
                    halfPointsToPx(cell.fontSizeHalfPoints),
                    theme
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
                    theme,
                  })
                ) : typeof renderedContent.text === 'string' && renderedContent.text.includes('\n') ? (
                  renderMultilineCell({
                    text: renderedContent.text,
                    x,
                    y,
                    width,
                    height,
                    cell,
                    theme,
                    textAnchor,
                    isHeader: rowIndex === 0 && columnIndex > 0,
                  })
                ) : (
                  <text
                    x={textX}
                    y={centerY}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fill={themedTextColor}
                    fontFamily={SUBJECT_FONT_FAMILY}
                    fontSize={fittedFont.fontSize}
                    fontWeight={rowIndex === 0 && columnIndex > 0 ? '600' : '500'}
                    stroke={themedStroke}
                    strokeWidth="4"
                    paintOrder="stroke"
                  >
                    {renderedContent.text}
                  </text>
                )
              ) : null}
            </g>
          );
        })
      )}

      {/* 학년-반 라벨 */}
      <text
        x={emuToViewBoxX(shared.classLabel.xEmu + shared.classLabel.widthEmu / 2)}
        y={emuToViewBoxY(shared.classLabel.yEmu + shared.classLabel.heightEmu / 2)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.labelTextColor}
        fontFamily={LABEL_FONT_FAMILY}
        fontSize={fitTextToWidth({
          text: template.classId,
          maxWidth: emuToViewBoxX(shared.classLabel.widthEmu) - 12,
          baseFontSize: halfPointsToPx(shared.classLabel.fontSizeHalfPoints),
          maxFontSize: emuToViewBoxY(shared.classLabel.heightEmu) * 0.82,
          fontFamily: LABEL_FONT_FAMILY,
        }).fontSize}
        fontWeight="normal"
        stroke={theme.labelStroke}
        strokeWidth="8"
        paintOrder="stroke"
      >
        {template.classId}
      </text>

      {/* 학교명 및 안내 푸터 */}
      {shared.schoolName ? (
        <g>
          <text
            x={tableX}
            y={footerY}
            textAnchor="start"
            dominantBaseline="middle"
            fill={theme.labelTextColor}
            fontFamily={LABEL_FONT_FAMILY}
            fontSize={fitTextToWidth({
              text: FOOTER_LABEL,
              maxWidth: emuToViewBoxX(shared.table.widthEmu) - 12,
              baseFontSize: halfPointsToPx(shared.schoolName.fontSizeHalfPoints) * 1.4,
              maxFontSize: emuToViewBoxY(shared.schoolName.heightEmu) * 1.2,
              minFontSize: 10,
              fontFamily: LABEL_FONT_FAMILY,
            }).fontSize}
            fontWeight="normal"
            stroke={theme.labelStroke}
            strokeWidth="4"
            paintOrder="stroke"
          >
            {FOOTER_LABEL}
          </text>
          <text
            x={tableX}
            y={footerY + 34}
            textAnchor="start"
            dominantBaseline="middle"
            fill={theme.labelTextColor}
            fontFamily={SUBJECT_FONT_FAMILY}
            fontSize={fitTextToWidth({
              text: FOOTER_NOTICE_LABEL,
              maxWidth: emuToViewBoxX(shared.table.widthEmu) - 12,
              baseFontSize: 19,
              maxFontSize: 21,
              minFontSize: 12,
              fontFamily: SUBJECT_FONT_FAMILY,
            }).fontSize}
            fontWeight="600"
            stroke={theme.labelStroke}
            strokeWidth="3"
            paintOrder="stroke"
          >
            {FOOTER_NOTICE_LABEL}
          </text>
        </g>
      ) : null}
    </svg>
  );
});

export default TimetableSvg;
