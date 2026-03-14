
import React from 'react';
import { DesignMap, CLOMapping, ModuleMapping, ModuleMLOs, CourseItem } from '../types';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, LevelFormat,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';

interface Props {
  data: DesignMap;
  onReset: () => void;
  reportType?: 'full' | 'partial';
}

const ItemIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'Reading': return '📄';
    case 'Multimedia': return '🎬';
    case 'Quiz': return '📝';
    case 'Assignment': return '📤';
    case 'Discussion': return '💬';
    default: return '🔗';
  }
};

export const MappingResult: React.FC<Props> = ({ data, onReset, reportType = 'full' }) => {
  const downloadWord = async () => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const BLUE = '0033A0';
    const ORANGE = 'D64309';
    const GRAY = '666666';
    const WHITE = 'FFFFFF';
    const FONT = 'Times New Roman';

    // ── Helpers ────────────────────────────────────────────────────
    const body = (text: string, opts: Record<string, any> = {}) =>
      new TextRun({ text, font: FONT, size: 24, ...opts });

    const h1 = (text: string, pageBreak = false) => new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: pageBreak,
      children: [new TextRun({ text, font: FONT })],
    });

    const h2 = (text: string) => new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text, font: FONT })],
    });

    const h3 = (text: string) => new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text })],
    });

    const docChildren: any[] = [];

    // ── COVER PAGE ────────────────────────────────────────────────
    const coverTitle = reportType === 'partial' ? 'LIST OF OBJECTIVES' : 'COURSE ALIGNMENT REPORT';
    docChildren.push(
      new Paragraph({ children: [], spacing: { before: 1440, after: 0 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: coverTitle, font: FONT, bold: true, size: 56, color: BLUE })],
      }),
      // Orange horizontal rule
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 1 } },
        spacing: { after: 600 },
        children: [],
      }),
      // Course Name
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Course Name:', font: FONT, bold: true, color: BLUE, size: 24 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: data.courseTitle, font: FONT, color: '000000', size: 24 })],
      }),
      // Prepared By
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Prepared By:', font: FONT, bold: true, color: BLUE, size: 24 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: '[Instructional Design Consultant] & [Faculty Developer Name]', font: FONT, color: '000000', size: 24, italics: true })],
      }),
      // Date
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Date:', font: FONT, bold: true, color: BLUE, size: 24 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: today, font: FONT, color: '000000', size: 24 })],
      }),
      // Institution footer on cover
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 8 } },
        spacing: { after: 60 },
        children: [new TextRun({ text: 'Boise State University', font: FONT, bold: true, color: BLUE, size: 22 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'eCampus Center', font: FONT, color: '000000', size: 24 })],
      }),
      new Paragraph({ pageBreakBefore: true, children: [] }),
    );

    // ── TABLE OF CONTENTS ─────────────────────────────────────────
    const tocItems = reportType === 'partial'
      ? [
        '1. University Learning Objectives (ULOs)',
        '    1.1 Interdisciplinary ULOs',
        '    1.2 Disciplinary ULOs',
        '2. Program Learning Objectives (PLOs)',
        '3. Course Learning Objectives (CLOs)',
        '4. Module Learning Objectives (MLOs)',
      ]
      : [
        '1. Executive Summary',
        '2. University Learning Objectives (ULOs)',
        '    2.1 Interdisciplinary ULOs',
        '    2.2 Disciplinary ULOs',
        '3. Program Learning Objectives (PLOs)',
        '4. Course Learning Objectives (CLOs)',
        '5. Module Learning Objectives (MLOs)',
        '6. Alignment Summary Matrix',
        '7. Feedback on Objectives (QM General Standard 2)',
        '8. Alignment Organized by CLOs',
        '9. Alignment Organized by Modules',
      ];
    docChildren.push(
      h1('Table of Contents'),
      ...tocItems.map(item => new Paragraph({ children: [body(item)], spacing: { after: 60 } })),
      new Paragraph({ pageBreakBefore: true, children: [] }),
    );

    // ── 1. EXECUTIVE SUMMARY (Full report only) ──────────────────
    if (reportType === 'full') {
      docChildren.push(
        h1('1. Executive Summary'),
        new Paragraph({
          children: [body(data.executiveSummary)],
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: ORANGE, space: 4 } },
          shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
          spacing: { before: 80, after: 80 },
        }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      );
    }

    // ── ULOs ───────────────────────────────────────────────────
    const uloSectionNum = reportType === 'partial' ? '1' : '2';
    const uloSubPrefix = reportType === 'partial' ? '1.' : '2.';
    docChildren.push(h1(`${uloSectionNum}. University Learning Objectives (ULOs)`));

    const interdisciplinary = data.ulos.filter(u => u.category === 'Interdisciplinary');
    const disciplinary = data.ulos.filter(u => u.category === 'Disciplinary');

    if (interdisciplinary.length > 0) {
      docChildren.push(h2(`${uloSubPrefix}1 Interdisciplinary ULOs`));
      interdisciplinary.forEach(u => {
        docChildren.push(new Paragraph({
          children: [
            body(`${u.name}`, { bold: true }),
            body(u.addressed ? ' ✓' : ''),
            body(` \u2014 `),
            body(u.reasoning, { italics: !u.addressed, color: u.addressed ? undefined : GRAY }),
          ],
          numbering: { reference: 'ulo-interdisciplinary', level: 0 },
          spacing: { after: 80 },
        }));
      });
    }

    if (disciplinary.length > 0) {
      docChildren.push(h2(`${uloSubPrefix}2 Disciplinary ULOs`));
      disciplinary.forEach(u => {
        docChildren.push(new Paragraph({
          children: [
            body(`${u.name}`, { bold: true }),
            body(u.addressed ? ' ✓' : ''),
            body(` \u2014 `),
            body(u.reasoning, { italics: !u.addressed, color: u.addressed ? undefined : GRAY }),
          ],
          numbering: { reference: 'ulo-disciplinary', level: 0 },
          spacing: { after: 80 },
        }));
      });
    }

    docChildren.push(new Paragraph({
      children: [body('Source: Boise State University \u2013 University Learning Outcomes', { size: 18, italics: true, color: GRAY })],
      spacing: { before: 100, after: 400 },
    }));

    // ── PLOs ───────────────────────────────────────────────────
    const ploSectionNum = reportType === 'partial' ? '2' : '3';
    if (data.plos && data.plos.length > 0) {
      docChildren.push(h1(`${ploSectionNum}. Program Learning Objectives (PLOs)`));
      data.plos.forEach((plo, i) => {
        docChildren.push(new Paragraph({
          children: [body(`PLO#${i + 1}: `, { bold: true }), body(plo)],
          spacing: { after: 100 },
        }));
      });
      docChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    }

    // ── CLOs ───────────────────────────────────────────────────
    const cloSectionNum = reportType === 'partial' ? '3' : '4';
    docChildren.push(h1(`${cloSectionNum}. Course Learning Objectives (CLOs)`));
    data.clos.forEach((clo, i) => {
      docChildren.push(new Paragraph({
        children: [body(`CLO#${i + 1}: `, { bold: true }), body(clo)],
        spacing: { after: 100 },
      }));
    });
    docChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

    // ── MLOs ───────────────────────────────────────────────────
    const mloSectionNum = reportType === 'partial' ? '4' : '5';
    docChildren.push(h1(`${mloSectionNum}. Module Learning Objectives (MLOs)`));
    data.mlosByModule.forEach(mod => {
      docChildren.push(
        h2(`${mod.moduleName} Learning Objectives`),
        ...mod.objectives.map((obj, i) => {
          const isDraft = mod.isGenerated;
          const draftLabel = isDraft ? ' [DRAFT MLO - AI-GENERATED]' : '';
          return new Paragraph({
            children: [body(`MLO#${i + 1}: `, { bold: true }), body(obj + draftLabel, { italics: isDraft, color: isDraft ? 'FF6B6B' : '000000' })],
            spacing: { after: 60 },
          });
        }),
      );
    });

    // ── 6-9. DETAILED ALIGNMENT SECTIONS (Full report only) ────────
    if (reportType === 'full') {
      // ── 6. ALIGNMENT SUMMARY MATRIX ───────────────────────────────
      docChildren.push(
        h1('6. Alignment Summary Matrix'),
        new Paragraph({
          children: [body('The table below provides a visual overview of how Course Learning Objectives (CLOs) map to University Learning Objectives (ULOs) and Program Learning Objectives (PLOs). Checkmarks indicate objectives addressed by the course.')],
          spacing: { after: 200 },
        }),
      );

      const labelColW = 3600;
      const cloColW = Math.max(500, Math.floor((9360 - labelColW) / Math.max(data.clos.length, 1)));
      const border = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
      const borders = { top: border, bottom: border, left: border, right: border };

      const matrixRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Objective', bold: true, size: 18, color: WHITE, font: FONT })], alignment: AlignmentType.CENTER })],
            width: { size: labelColW, type: WidthType.DXA }, borders,
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
          ...data.clos.map((_, i) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `CLO#${i + 1}`, bold: true, size: 18, color: WHITE, font: FONT })], alignment: AlignmentType.CENTER })],
            width: { size: cloColW, type: WidthType.DXA }, borders,
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 60, right: 60 },
          })),
        ],
      }),
      ...data.ulos.map((u, i) => new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `ULO: ${u.name}`, size: 18, font: FONT })] })],
            width: { size: labelColW, type: WidthType.DXA }, borders,
            shading: { fill: i % 2 === 0 ? 'EEF2FF' : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          }),
          ...data.clos.map(() => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: u.addressed ? '\u2713' : '', size: 18, color: BLUE, bold: true })], alignment: AlignmentType.CENTER })],
            width: { size: cloColW, type: WidthType.DXA }, borders,
            shading: { fill: i % 2 === 0 ? 'EEF2FF' : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
          })),
        ],
      })),
      ...(data.plos || []).map((plo, i) => {
        const label = `PLO#${i + 1}: ${plo.length > 55 ? plo.substring(0, 52) + '...' : plo}`;
        const shade = (data.ulos.length + i) % 2 === 0 ? 'EEF2FF' : 'FFFFFF';
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, size: 18, font: FONT })] })],
              width: { size: labelColW, type: WidthType.DXA }, borders,
              shading: { fill: shade, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
            ...data.clos.map(() => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '\u2713', size: 18, color: BLUE, bold: true })], alignment: AlignmentType.CENTER })],
              width: { size: cloColW, type: WidthType.DXA }, borders,
              shading: { fill: shade, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 60, right: 60 },
            })),
          ],
        });
      }),
    ];

    docChildren.push(
        new Table({
          width: { size: labelColW + cloColW * data.clos.length, type: WidthType.DXA },
          columnWidths: [labelColW, ...data.clos.map(() => cloColW)],
          rows: matrixRows,
        }),
        new Paragraph({ spacing: { after: 400 }, children: [] }),
      );

      // ── 7. QM FEEDBACK ────────────────────────────────────────────
      docChildren.push(
        h1('7. Feedback on Objectives (QM General Standard 2)'),
        new Paragraph({
          children: [body('Source: QM Course Design Rubric Standards (Higher Education)', { size: 18, italics: true, color: GRAY })],
          spacing: { after: 200 },
        }),
        ...[
          { id: '2.1', title: 'The course-level learning objectives describe outcomes that are measurable.', text: data.qmFeedback.qm2_1 },
          { id: '2.2', title: 'The module/unit-level learning objectives describe outcomes that are measurable and consistent with the course-level objectives.', text: data.qmFeedback.qm2_2 },
          { id: '2.3', title: 'Learning objectives are clearly stated, are learner-centered, and are prominently located in the course.', text: data.qmFeedback.qm2_3 },
          { id: '2.4', title: 'The relationship between learning objectives, learning activities, and assessments is made clear.', text: data.qmFeedback.qm2_4 },
          { id: '2.5', title: 'The learning objectives are suited to and reflect the level of the course.', text: data.qmFeedback.qm2_5 },
        ].flatMap(qm => [
          h2(`QM ${qm.id}: ${qm.title}`),
          new Paragraph({ children: [body(qm.text)], spacing: { after: 200 } }),
        ]),
      );

      // ── 8. ALIGNMENT BY CLOs ──────────────────────────────────────
      docChildren.push(h1('8. Alignment Organized by CLOs', true));
      data.cloMappings.forEach((mapping, idx) => {
        docChildren.push(
          h2(`CLO#${idx + 1}: ${mapping.clo}`),
          h3('Relevant Module Objectives & Associated Assessments/Activities'),
        );
        mapping.alignedModules.forEach(mo => {
          docChildren.push(new Paragraph({ children: [body(`${mo.moduleName}: ${mo.objective}`)], bullet: { level: 0 }, spacing: { after: 50 } }));
          mo.items.forEach(item => {
            docChildren.push(new Paragraph({ children: [body(`[${item.type}] ${item.title}`)], bullet: { level: 1 }, spacing: { after: 50 } }));
          });
        });
        docChildren.push(
          h3('Findings'),
          new Paragraph({ children: [body(mapping.findings)], spacing: { after: 100 } }),
          h3('Recommendations'),
          new Paragraph({ children: [body(mapping.recommendations)], spacing: { after: 300 } }),
        );
      });

      // ── 9. ALIGNMENT BY MODULES ───────────────────────────────────
      docChildren.push(h1('9. Alignment Organized by Modules', true));
      data.moduleMappings.forEach(mod => {
        docChildren.push(
          h2(mod.moduleName),
          h3('Relevant CLOs, MLOs, & Associated Assessments/Activities'),
          ...mod.relevantCLOs.map(clo => new Paragraph({ children: [body(`CLO: ${clo}`)], bullet: { level: 0 }, spacing: { after: 50 } })),
          ...mod.relevantMLOs.map(mlo => new Paragraph({ children: [body(`MLO: ${mlo}`)], bullet: { level: 0 }, spacing: { after: 50 } })),
          h3('Findings'),
          new Paragraph({ children: [body(mod.findings)], spacing: { after: 100 } }),
          h3('Recommendations'),
          new Paragraph({ children: [body(mod.recommendations)], spacing: { after: 300 } }),
        );
      });
    }

    // ── BUILD DOCUMENT ────────────────────────────────────────────
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: FONT, size: 24 } },
        },
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            paragraph: {
              shading: { fill: BLUE, type: ShadingType.CLEAR },
              spacing: { before: 360, after: 160 },
              indent: { left: 200, right: 200 },
              outlineLevel: 0,
            },
            run: { font: FONT, bold: true, color: WHITE, size: 32 },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            paragraph: {
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ORANGE, space: 1 } },
              spacing: { before: 280, after: 120 },
              outlineLevel: 1,
            },
            run: { font: FONT, bold: true, color: BLUE, size: 26 },
          },
          {
            id: 'Heading3',
            name: 'Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
            run: { font: 'Arial', bold: true, color: ORANGE, size: 22 },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: 'ulo-interdisciplinary',
            levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
          {
            reference: 'ulo-disciplinary',
            levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
          },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = reportType === 'partial'
      ? `${data.courseTitle.replace(/[^a-z0-9]/gi, '_')}_Objectives_List.docx`
      : `${data.courseTitle.replace(/[^a-z0-9]/gi, '_')}_QM_Alignment_Report.docx`;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      {/* Fallback model notice */}
      {data.usedFallbackModel && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 text-sm text-amber-800">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p><span className="font-bold">Compatibility mode:</span> The Pro model was unavailable on your free tier, so the alignment analysis was completed using Flash-Lite. Results are accurate but may be slightly less detailed than Pro-quality output. To access Pro, upgrade to a paid Gemini API plan.</p>
        </div>
      )}

      {/* Cover header — matches DOCX cover page style */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#0033A0] px-10 py-8 text-center">
          <h2 className="text-3xl font-extrabold text-white uppercase tracking-widest">
            {reportType === 'partial' ? 'List of Objectives' : 'Course Alignment Report'}
          </h2>
        </div>
        <div className="h-1.5 bg-[#D64309]" />
        <div className="px-10 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Course Name</p>
            <p className="text-2xl font-bold text-slate-900">{data.courseTitle}</p>
            {data.courseLength && <p className="text-slate-500 text-base">{data.courseLength}</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button onClick={downloadWord} className="px-8 py-4 text-lg font-bold text-white bg-[#0033A0] hover:bg-blue-900 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3">
              Download .docx
            </button>
            <button onClick={onReset} className="px-8 py-4 text-lg font-bold text-red-600 hover:text-white hover:bg-red-600 bg-white rounded-xl transition-all border border-red-200">
              Clear Report
            </button>
          </div>
        </div>
      </div>

      {reportType === 'full' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
            <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">Executive Summary</h3>
          </div>
          <div className="p-10">
            <p className="text-slate-700 text-xl leading-relaxed">{data.executiveSummary}</p>
          </div>
        </div>
      )}

      {data.ulos && data.ulos.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
            <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">List of University Learning Objectives (ULOs)</h3>
          </div>
          <div className="p-10">

          <div className="space-y-8">
            {['Interdisciplinary', 'Disciplinary'].map(cat => {
              const items = data.ulos.filter(u => u.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h4 className="text-2xl font-bold text-[#0033A0] mb-6">{cat}</h4>
                  <div className="grid gap-4">
                    {items.map(u => (
                      <div key={u.id} className="p-5 rounded-xl border bg-slate-50 border-slate-100">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 shrink-0 w-7 h-7 border-2 border-slate-300 rounded flex items-center justify-center text-blue-600 font-bold text-lg">
                            {u.addressed ? '✓' : ''}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-lg">{u.name}</p>
                            <p className="text-slate-600 text-base italic mt-1">{u.reasoning}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-sm text-slate-400 italic">Source: <a href="https://www.boisestate.edu/provost/university-learning-outcomes/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">University Learning Outcomes</a></p>
          </div>
        </section>
      )}

      {data.plos && data.plos.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
            <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">List of Program Learning Objectives (PLOs)</h3>
          </div>
          <div className="p-10 space-y-4">
            {data.plos.map((plo, i) => (
              <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-xl">
                <span className="font-bold text-[#0033A0] shrink-0 text-lg">PLO#{i+1}:</span>
                <p className="text-slate-700 text-lg">{plo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
          <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">List of Course Learning Objectives (CLOs)</h3>
        </div>
        <div className="p-10 space-y-4">
          {data.clos.map((clo, i) => (
            <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-xl">
              <span className="font-bold text-[#0033A0] shrink-0 text-lg">CLO#{i+1}:</span>
              <p className="text-slate-700 text-lg">{clo}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
          <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">List of Module Learning Objectives (MLOs)</h3>
        </div>
        <div className="p-10 space-y-12">
          {data.mlosByModule.map((mod, i) => (
            <div key={i}>
              <h4 className="text-2xl font-bold text-[#0033A0] mb-6">{mod.moduleName}</h4>
              <div className="space-y-3 pl-6 border-l-4 border-[#D64309]">
                {mod.objectives.map((obj, objIdx) => (
                  <div key={objIdx} className="flex gap-3 items-start">
                    <span className="font-bold text-slate-500 shrink-0 text-lg">MLO#{objIdx+1}:</span>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-1">
                        <p className="text-slate-700 text-lg">{obj}</p>
                        {mod.isGenerated && (
                          <span className="inline-block px-2.5 py-1 bg-orange-50 text-[#D64309] text-xs font-bold rounded-full border border-orange-200">Draft MLO</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {reportType === 'full' && (
        <>
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
              <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">Feedback On Objectives (QM General Standard 2)</h3>
            </div>
            <div className="p-10 space-y-8">
              {[
                { id: '2.1', title: 'The course-level learning objectives describe outcomes that are measurable.', text: data.qmFeedback.qm2_1 },
                { id: '2.2', title: 'The module/unit-level learning objectives describe outcomes that are measurable and consistent with the course-level objectives.', text: data.qmFeedback.qm2_2 },
                { id: '2.3', title: 'Learning objectives are clearly stated, are learner-centered, and are prominently located in the course.', text: data.qmFeedback.qm2_3 },
                { id: '2.4', title: 'The relationship between learning objectives, learning activities, and assessments is made clear.', text: data.qmFeedback.qm2_4 },
                { id: '2.5', title: 'The learning objectives are suited to and reflect the level of the course.', text: data.qmFeedback.qm2_5 }
              ].map((qm, i) => (
                <div key={i} className="bg-slate-50 p-8 rounded-xl border-l-4 border-[#0033A0]">
                  <h4 className="font-bold text-[#0033A0] text-xl mb-3">QM {qm.id}: {qm.title}</h4>
                  <p className="text-slate-600 text-lg leading-relaxed italic">"{qm.text}"</p>
                </div>
              ))}
              <p className="text-sm text-slate-400 italic">Source: <a href="https://www.qualitymatters.org/qa-resources/rubric-standards/higher-ed-publisher-rubric" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">QM Course Design Rubric Standards (Higher Ed. Standards)</a></p>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
              <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">Alignment Organized By CLOs</h3>
            </div>
          </section>
          <div className="space-y-8">
            {data.cloMappings.map((mapping, idx) => (
              <section key={idx} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                <div className="p-8 border-b-2 border-[#D64309] bg-slate-50">
                  <h3 className="text-2xl font-bold text-[#0033A0]">CLO#{idx + 1}: {mapping.clo}</h3>
                </div>
                <div className="p-8 space-y-8">
                  <h4 className="font-bold text-slate-800 text-xl">Relevant Module Objectives & Associated Assessments/Activities</h4>
                  {mapping.alignedModules.map((mo, moIdx) => (
                    <div key={moIdx} className="border-l-4 border-blue-500 pl-8 py-3">
                      <p className="text-2xl font-medium text-slate-800 mb-5"><span className="text-blue-600 font-bold">{mo.moduleName}:</span> {mo.objective}</p>
                      <div className="flex flex-wrap gap-4">
                        {mo.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 text-base shadow-sm">
                            <ItemIcon type={item.type} />
                            <span className="font-semibold text-slate-600">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="space-y-8 pt-8 border-t border-slate-100">
                    <div>
                      <h5 className="font-bold text-slate-900 text-xl mb-3">Findings</h5>
                      <p className="text-slate-700 text-xl leading-relaxed">{mapping.findings}</p>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xl mb-3">Recommendations</h5>
                      <p className="text-slate-700 text-xl leading-relaxed">{mapping.recommendations}</p>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b-2 border-[#D64309] px-10 pt-8 pb-4">
              <h3 className="text-2xl font-extrabold text-[#0033A0] text-center uppercase tracking-widest">Alignment Organized By Modules</h3>
            </div>
          </section>
          <div className="space-y-8">
            {data.moduleMappings.map((mod, idx) => (
              <section key={idx} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                <div className="p-8 border-b-2 border-[#D64309] bg-slate-50">
                  <h3 className="text-2xl font-bold text-[#0033A0]">{mod.moduleName}</h3>
                </div>
                <div className="p-8 space-y-8">
                  <h4 className="font-bold text-slate-800 text-xl">Relevant CLOs, MLO, & Associated Assessments/Activities</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-sm font-bold text-slate-500 uppercase mb-3 tracking-widest">Relevant CLOs</p>
                      <ul className="list-disc ml-6 space-y-2">
                        {mod.relevantCLOs.map((clo, i) => <li key={i} className="text-slate-700 text-lg">{clo}</li>)}
                      </ul>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-sm font-bold text-slate-500 uppercase mb-3 tracking-widest">Relevant MLOs</p>
                      <ul className="list-disc ml-6 space-y-2">
                        {mod.relevantMLOs.map((mlo, i) => <li key={i} className="text-slate-700 text-lg">{mlo}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-8 pt-8 border-t border-slate-100">
                    <div>
                      <h5 className="font-bold text-slate-900 text-xl mb-3">Findings</h5>
                      <p className="text-slate-700 text-xl leading-relaxed">{mod.findings}</p>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xl mb-3">Recommendations</h5>
                      <p className="text-slate-700 text-xl leading-relaxed">{mod.recommendations}</p>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
