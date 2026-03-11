
import React from 'react';
import { DesignMap, CLOMapping, ModuleMapping, ModuleMLOs, CourseItem } from '../types';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';

interface Props {
  data: DesignMap;
  onReset: () => void;
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

export const MappingResult: React.FC<Props> = ({ data, onReset }) => {
  const downloadWord = async () => {
    const docChildren: any[] = [];
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const BLUE = '0033A0';
    const GRAY = '666666';
    const WHITE = 'FFFFFF';

    const sectionTitle = (text: string, pageBreak = false) => new Paragraph({
      children: [new TextRun({ text, bold: true, size: 28, color: BLUE })],
      spacing: { before: 400, after: 200 },
      pageBreakBefore: pageBreak,
    });

    const subSectionTitle = (text: string) => new Paragraph({
      children: [new TextRun({ text, bold: true, size: 24, color: BLUE })],
      spacing: { before: 300, after: 100 },
    });

    // ── COVER PAGE ────────────────────────────────────────────────
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'COURSE ALIGNMENT REPORT', bold: true, size: 56, color: BLUE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 2880, after: 600 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Course Name: ', bold: true, size: 26 }),
          new TextRun({ text: data.courseTitle, size: 26 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Prepared By: ', bold: true, size: 24 }),
          new TextRun({ text: '[Instructional Design Consultant] & [Faculty Developer Name]', size: 24, italics: true, color: GRAY }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Date: ', bold: true, size: 24 }),
          new TextRun({ text: today, size: 24 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Boise State University', bold: true, size: 24, color: BLUE })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'eCampus Center', bold: true, size: 24, color: BLUE })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
      new Paragraph({ pageBreakBefore: true, children: [] }),
    );

    // ── TABLE OF CONTENTS ─────────────────────────────────────────
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32, color: BLUE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 300 },
      }),
      ...[
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
      ].map(item => new Paragraph({
        children: [new TextRun({ text: item, size: 22 })],
        spacing: { after: 60 },
      })),
      new Paragraph({ pageBreakBefore: true, children: [] }),
    );

    // ── 1. EXECUTIVE SUMMARY ──────────────────────────────────────
    docChildren.push(
      sectionTitle('1. Executive Summary'),
      new Paragraph({ text: data.executiveSummary, spacing: { after: 400 } }),
    );

    // ── 2. ULOs ───────────────────────────────────────────────────
    docChildren.push(sectionTitle('2. University Learning Objectives (ULOs)'));

    const interdisciplinary = data.ulos.filter(u => u.category === 'Interdisciplinary');
    const disciplinary = data.ulos.filter(u => u.category === 'Disciplinary');

    if (interdisciplinary.length > 0) {
      docChildren.push(subSectionTitle('2.1 Interdisciplinary ULOs'));
      interdisciplinary.forEach(u => {
        docChildren.push(new Paragraph({
          children: [
            new TextRun({ text: u.addressed ? '☑ ' : '☐ ', bold: true }),
            new TextRun({ text: `${u.name} — `, bold: true }),
            new TextRun({ text: u.reasoning, italics: true }),
          ],
          spacing: { after: 100 },
        }));
      });
    }

    if (disciplinary.length > 0) {
      docChildren.push(subSectionTitle('2.2 Disciplinary ULOs'));
      disciplinary.forEach(u => {
        docChildren.push(new Paragraph({
          children: [
            new TextRun({ text: u.addressed ? '☑ ' : '☐ ', bold: true }),
            new TextRun({ text: `${u.name} — `, bold: true }),
            new TextRun({ text: u.reasoning, italics: true }),
          ],
          spacing: { after: 100 },
        }));
      });
    }

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'Source: Boise State University – University Learning Outcomes', size: 18, italics: true, color: GRAY })],
      spacing: { before: 100, after: 400 },
    }));

    // ── 3. PLOs ───────────────────────────────────────────────────
    if (data.plos && data.plos.length > 0) {
      docChildren.push(sectionTitle('3. Program Learning Objectives (PLOs)'));
      data.plos.forEach((plo, i) => {
        docChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `PLO#${i + 1}: `, bold: true }),
            new TextRun({ text: plo }),
          ],
          spacing: { after: 100 },
        }));
      });
      docChildren.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // ── 4. CLOs ───────────────────────────────────────────────────
    docChildren.push(sectionTitle('4. Course Learning Objectives (CLOs)'));
    data.clos.forEach((clo, i) => {
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `CLO#${i + 1}: `, bold: true }),
          new TextRun({ text: clo }),
        ],
        spacing: { after: 100 },
      }));
    });
    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // ── 5. MLOs ───────────────────────────────────────────────────
    docChildren.push(sectionTitle('5. Module Learning Objectives (MLOs)'));
    data.mlosByModule.forEach(mod => {
      docChildren.push(
        subSectionTitle(`${mod.moduleName} Learning Objectives`),
        ...mod.objectives.map((obj, i) => new Paragraph({
          children: [
            new TextRun({ text: `MLO#${i + 1}: `, bold: true }),
            new TextRun({ text: obj }),
          ],
          spacing: { after: 60 },
        })),
      );
    });

    // ── 6. ALIGNMENT SUMMARY MATRIX ───────────────────────────────
    docChildren.push(
      sectionTitle('6. Alignment Summary Matrix'),
      new Paragraph({
        children: [new TextRun({
          text: 'The table below provides a visual overview of how Course Learning Objectives (CLOs) map to University Learning Objectives (ULOs) and Program Learning Objectives (PLOs). Checkmarks indicate objectives addressed by the course.',
          size: 20,
        })],
        spacing: { after: 200 },
      }),
    );

    const labelColW = 3600;
    const cloColW = Math.max(500, Math.floor((9360 - labelColW) / Math.max(data.clos.length, 1)));
    const border = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
    const borders = { top: border, bottom: border, left: border, right: border };

    const matrixRows = [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Objective', bold: true, size: 18, color: WHITE })], alignment: AlignmentType.CENTER })],
            width: { size: labelColW, type: WidthType.DXA },
            borders,
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
          ...data.clos.map((_, i) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `CLO#${i + 1}`, bold: true, size: 18, color: WHITE })], alignment: AlignmentType.CENTER })],
            width: { size: cloColW, type: WidthType.DXA },
            borders,
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 60, right: 60 },
          })),
        ],
      }),
      // ULO rows
      ...data.ulos.map((u, i) => new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `ULO: ${u.name}`, size: 18 })] })],
            width: { size: labelColW, type: WidthType.DXA },
            borders,
            shading: { fill: i % 2 === 0 ? 'EEF2FF' : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          }),
          ...data.clos.map(() => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: u.addressed ? '✓' : '', size: 18, color: BLUE, bold: true })], alignment: AlignmentType.CENTER })],
            width: { size: cloColW, type: WidthType.DXA },
            borders,
            shading: { fill: i % 2 === 0 ? 'EEF2FF' : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
          })),
        ],
      })),
      // PLO rows
      ...(data.plos || []).map((plo, i) => {
        const label = `PLO#${i + 1}: ${plo.length > 55 ? plo.substring(0, 52) + '...' : plo}`;
        const shade = (data.ulos.length + i) % 2 === 0 ? 'EEF2FF' : 'FFFFFF';
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, size: 18 })] })],
              width: { size: labelColW, type: WidthType.DXA },
              borders,
              shading: { fill: shade, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
            ...data.clos.map(() => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '✓', size: 18, color: BLUE, bold: true })], alignment: AlignmentType.CENTER })],
              width: { size: cloColW, type: WidthType.DXA },
              borders,
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
      new Paragraph({ spacing: { after: 400 } }),
    );

    // ── 7. QM FEEDBACK ────────────────────────────────────────────
    docChildren.push(
      sectionTitle('7. Feedback on Objectives (QM General Standard 2)'),
      new Paragraph({
        children: [new TextRun({ text: 'Source: QM Course Design Rubric Standards (Higher Education)', size: 18, italics: true, color: GRAY })],
        spacing: { after: 200 },
      }),
      ...[
        { id: '2.1', title: 'The course-level learning objectives describe outcomes that are measurable.', text: data.qmFeedback.qm2_1 },
        { id: '2.2', title: 'The module/unit-level learning objectives describe outcomes that are measurable and consistent with the course-level objectives.', text: data.qmFeedback.qm2_2 },
        { id: '2.3', title: 'Learning objectives are clearly stated, are learner-centered, and are prominently located in the course.', text: data.qmFeedback.qm2_3 },
        { id: '2.4', title: 'The relationship between learning objectives, learning activities, and assessments is made clear.', text: data.qmFeedback.qm2_4 },
        { id: '2.5', title: 'The learning objectives are suited to and reflect the level of the course.', text: data.qmFeedback.qm2_5 },
      ].flatMap(qm => [
        new Paragraph({ children: [new TextRun({ text: `QM ${qm.id}: ${qm.title}`, bold: true, color: BLUE })], spacing: { before: 200, after: 80 } }),
        new Paragraph({ text: qm.text, spacing: { after: 200 } }),
      ]),
    );

    // ── 8. ALIGNMENT BY CLOs ──────────────────────────────────────
    docChildren.push(sectionTitle('8. Alignment Organized by CLOs', true));
    data.cloMappings.forEach((mapping, idx) => {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `CLO#${idx + 1}: ${mapping.clo}`, bold: true, size: 24, color: BLUE })],
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({ children: [new TextRun({ text: 'Relevant Module Objectives & Associated Assessments/Activities', bold: true })], spacing: { after: 80 } }),
      );
      mapping.alignedModules.forEach(mo => {
        docChildren.push(new Paragraph({ text: `${mo.moduleName}: ${mo.objective}`, bullet: { level: 0 }, spacing: { after: 50 } }));
        mo.items.forEach(item => {
          docChildren.push(new Paragraph({ text: `[${item.type}] ${item.title}`, bullet: { level: 1 }, spacing: { after: 50 } }));
        });
      });
      docChildren.push(
        new Paragraph({ children: [new TextRun({ text: 'Findings', bold: true })], spacing: { before: 200, after: 60 } }),
        new Paragraph({ text: mapping.findings, spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: 'Recommendations', bold: true })], spacing: { before: 100, after: 60 } }),
        new Paragraph({ text: mapping.recommendations, spacing: { after: 300 } }),
      );
    });

    // ── 9. ALIGNMENT BY MODULES ───────────────────────────────────
    docChildren.push(sectionTitle('9. Alignment Organized by Modules', true));
    data.moduleMappings.forEach(mod => {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: mod.moduleName, bold: true, size: 24, color: BLUE })],
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({ children: [new TextRun({ text: 'Relevant CLOs, MLOs, & Associated Assessments/Activities', bold: true })], spacing: { after: 80 } }),
        ...mod.relevantCLOs.map(clo => new Paragraph({ text: `CLO: ${clo}`, bullet: { level: 0 }, spacing: { after: 50 } })),
        ...mod.relevantMLOs.map(mlo => new Paragraph({ text: `MLO: ${mlo}`, bullet: { level: 0 }, spacing: { after: 50 } })),
        new Paragraph({ children: [new TextRun({ text: 'Findings', bold: true })], spacing: { before: 200, after: 60 } }),
        new Paragraph({ text: mod.findings, spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: 'Recommendations', bold: true })], spacing: { before: 100, after: 60 } }),
        new Paragraph({ text: mod.recommendations, spacing: { after: 300 } }),
      );
    });

    const doc = new Document({ sections: [{ children: docChildren }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.courseTitle.replace(/[^a-z0-9]/gi, '_')}_QM_Alignment_Report.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-10 rounded-xl shadow-sm border border-slate-200 gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-slate-900">{data.courseTitle}</h2>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-slate-500 text-xl">Course Design Alignment Report</p>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <p className="text-slate-500 text-xl">{data.courseLength}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <button onClick={downloadWord} className="px-8 py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3">
            Download .docx
          </button>
          <button onClick={onReset} className="px-8 py-4 text-lg font-bold text-red-600 hover:text-white hover:bg-red-600 bg-white rounded-xl transition-all border border-red-200">
            Clear Report
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-10 rounded-xl shadow-sm">
        <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 uppercase tracking-wide">Executive Summary</h3>
        <p className="text-slate-700 text-xl leading-relaxed">{data.executiveSummary}</p>
      </div>

      {data.ulos && data.ulos.length > 0 && (
        <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
          <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 border-b pb-4">List of University Learning Objectives (ULOs)</h3>
          
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
        </section>
      )}

      {data.plos && data.plos.length > 0 && (
        <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
          <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 border-b pb-4">List of Program Learning Objectives (PLOs)</h3>
          <div className="space-y-4">
            {data.plos.map((plo, i) => (
              <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-xl">
                <span className="font-bold text-[#0033A0] shrink-0 text-lg">PLO#{i+1}:</span>
                <p className="text-slate-700 text-lg">{plo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
        <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 border-b pb-4">List of Course Learning Objectives (CLOs)</h3>
        <div className="space-y-4">
          {data.clos.map((clo, i) => (
            <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-xl">
              <span className="font-bold text-[#0033A0] shrink-0 text-lg">CLO#{i+1}:</span>
              <p className="text-slate-700 text-lg">{clo}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
        <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 border-b pb-4">List of Module Learning Objectives (MLOs)</h3>
        <div className="space-y-12">
          {data.mlosByModule.map((mod, i) => (
            <div key={i}>
              <h4 className="text-2xl font-bold text-[#0033A0] mb-6">Module Learning Objectives From {mod.moduleName}</h4>
              <div className="space-y-3 pl-6 border-l-4 border-blue-100">
                {mod.objectives.map((obj, objIdx) => (
                  <div key={objIdx} className="flex gap-3">
                    <span className="font-bold text-slate-500 shrink-0 text-lg">MLO#{objIdx+1}:</span>
                    <p className="text-slate-700 text-lg">{obj}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200">
        <h3 className="text-3xl font-bold text-[#E36C09] text-center mb-8 border-b pb-4">Feedback On Objectives (QM General Standard 2)</h3>
        <div className="space-y-8">
          {[
            { id: '2.1', title: 'The course-level learning objectives describe outcomes that are measurable.', text: data.qmFeedback.qm2_1 },
            { id: '2.2', title: 'The module/unit-level learning objectives describe outcomes that are measurable and consistent with the course-level objectives.', text: data.qmFeedback.qm2_2 },
            { id: '2.3', title: 'Learning objectives are clearly stated, are learner-centered, and are prominently located in the course.', text: data.qmFeedback.qm2_3 },
            { id: '2.4', title: 'The relationship between learning objectives, learning activities, and assessments is made clear.', text: data.qmFeedback.qm2_4 },
            { id: '2.5', title: 'The learning objectives are suited to and reflect the level of the course.', text: data.qmFeedback.qm2_5 }
          ].map((qm, i) => (
            <div key={i} className="bg-slate-50 p-8 rounded-xl border border-slate-100">
              <h4 className="font-bold text-[#0033A0] text-xl mb-3">QM {qm.id}: {qm.title}</h4>
              <p className="text-slate-600 text-lg leading-relaxed italic">"{qm.text}"</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-slate-400 italic">Source: <a href="https://www.qualitymatters.org/qa-resources/rubric-standards/higher-ed-publisher-rubric" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">QM Course Design Rubric Standards (Higher Ed. Standards)</a></p>
      </section>

      <div className="space-y-16">
        <h3 className="text-4xl font-bold text-center text-[#E36C09]">Alignment Organized By CLOs</h3>
        {data.cloMappings.map((mapping, idx) => (
          <section key={idx} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
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

      <div className="space-y-16">
        <h3 className="text-4xl font-bold text-center text-[#E36C09]">Alignment Organized By Modules</h3>
        {data.moduleMappings.map((mod, idx) => (
          <section key={idx} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
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
    </div>
  );
};
