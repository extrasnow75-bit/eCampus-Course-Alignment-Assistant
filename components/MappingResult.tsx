
import React from 'react';
import { DesignMap, CLOMapping, ModuleMapping, ModuleMLOs, CourseItem } from '../types';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

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

    // Header
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: data.courseTitle, bold: true, size: 48 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Course Design Alignment Report", size: 28, color: "666666" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Executive Summary", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        text: data.executiveSummary,
        spacing: { after: 600 },
      })
    );

    // List of ULOs
    if (data.ulos && data.ulos.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "List of University Learning Objectives (ULOs)", bold: true, size: 32, color: "E36C09" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 400 },
        })
      );

      const interdisciplinary = data.ulos.filter(u => u.category === 'Interdisciplinary');
      const disciplinary = data.ulos.filter(u => u.category === 'Disciplinary');

      if (interdisciplinary.length > 0) {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: "Interdisciplinary", bold: true, size: 28, color: "0033A0" })], spacing: { before: 200, after: 100 } }));
        interdisciplinary.forEach(u => {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: u.addressed ? "☑ " : "☐ ", bold: true }),
                new TextRun({ text: `${u.name} – `, bold: true }),
                new TextRun({ text: u.reasoning, italics: true })
              ],
              spacing: { after: 100 }
            })
          );
        });
      }

      if (disciplinary.length > 0) {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: "Disciplinary", bold: true, size: 28, color: "0033A0" })], spacing: { before: 200, after: 100 } }));
        disciplinary.forEach(u => {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: u.addressed ? "☑ " : "☐ ", bold: true }),
                new TextRun({ text: `${u.name} – `, bold: true }),
                new TextRun({ text: u.reasoning, italics: true })
              ],
              spacing: { after: 100 }
            })
          );
        });
      }
      
      docChildren.push(new Paragraph({ children: [new TextRun({ text: "Source: University Learning Outcomes", size: 18, italics: true, color: "0033A0" })], spacing: { before: 100, after: 400 } }));
    }

    // List of PLOs
    if (data.plos && data.plos.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "List of Program Learning Objectives (PLOs)", bold: true, size: 32, color: "E36C09" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 400 },
        }),
        ...data.plos.map((plo, i) => new Paragraph({
          children: [
            new TextRun({ text: `PLO#${i + 1}: `, bold: true }),
            new TextRun({ text: plo })
          ],
          spacing: { after: 100 }
        }))
      );
    }

    // List of CLOs
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "List of Course Learning Objectives (CLOs)", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
      }),
      ...data.clos.map((clo, i) => new Paragraph({
        children: [
          new TextRun({ text: `CLO#${i + 1}: `, bold: true }),
          new TextRun({ text: clo })
        ],
        spacing: { after: 100 }
      }))
    );

    // List of MLOs
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "List of Module Learning Objectives (MLOs)", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
      })
    );

    data.mlosByModule.forEach(mod => {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `Module Learning Objectives From ${mod.moduleName}`, bold: true, size: 28, color: "0033A0" })],
          spacing: { before: 300, after: 100 },
        }),
        ...mod.objectives.map((obj, i) => new Paragraph({
          children: [
            new TextRun({ text: `MLO#${i + 1}: `, bold: true }),
            new TextRun({ text: obj })
          ],
          spacing: { after: 50 }
        }))
      );
    });

    // QM Feedback Section
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "Feedback On Objectives (QM General Standard 2)", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        pageBreakBefore: true,
      }),
      new Paragraph({ children: [new TextRun({ text: "QM 2.1: The course-level learning objectives describe outcomes that are measurable.", bold: true, color: "0033A0" })] }),
      new Paragraph({ text: data.qmFeedback.qm2_1, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "QM 2.2: The module/unit-level learning objectives describe outcomes that are measurable and consistent with the course-level objectives.", bold: true, color: "0033A0" })] }),
      new Paragraph({ text: data.qmFeedback.qm2_2, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "QM 2.3: Learning objectives are clearly stated, are learner-centered, and are prominently located in the course.", bold: true, color: "0033A0" })] }),
      new Paragraph({ text: data.qmFeedback.qm2_3, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "QM 2.4: The relationship between learning objectives, learning activities, and assessments is made clear.", bold: true, color: "0033A0" })] }),
      new Paragraph({ text: data.qmFeedback.qm2_4, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "QM 2.5: The learning objectives are suited to and reflect the level of the course.", bold: true, color: "0033A0" })] }),
      new Paragraph({ text: data.qmFeedback.qm2_5, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Source: QM Course Design Rubric Standards (Higher Ed. Standards)", size: 18, italics: true, color: "0033A0" })], spacing: { before: 100, after: 600 } })
    );

    // Alignment by CLOs
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "Alignment Organized By CLOs", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        pageBreakBefore: true,
      })
    );

    data.cloMappings.forEach((mapping, idx) => {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `CLO#${idx + 1}: ${mapping.clo}`, bold: true, size: 28, color: "0033A0" })],
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({ children: [new TextRun({ text: "Relevant Module Objectives & Associated Assessments/Activities", bold: true })] }),
      );

      mapping.alignedModules.forEach(mo => {
        docChildren.push(new Paragraph({ text: `${mo.moduleName}: ${mo.objective}`, bullet: { level: 0 }, spacing: { after: 50 } }));
        mo.items.forEach(item => {
          docChildren.push(new Paragraph({ text: `[${item.type}] ${item.title}`, bullet: { level: 1 }, spacing: { after: 50 } }));
        });
      });

      docChildren.push(
        new Paragraph({ children: [new TextRun({ text: "Findings", bold: true })], spacing: { before: 200 } }),
        new Paragraph({ text: mapping.findings }),
        new Paragraph({ children: [new TextRun({ text: "Recommendations", bold: true })], spacing: { before: 100 } }),
        new Paragraph({ text: mapping.recommendations, spacing: { after: 400 } })
      );
    });

    // Alignment by Modules
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "Alignment Organized By Modules", bold: true, size: 32, color: "E36C09" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        pageBreakBefore: true,
      })
    );

    data.moduleMappings.forEach((mod) => {
      docChildren.push(
        new Paragraph({ children: [new TextRun({ text: mod.moduleName, bold: true, size: 28, color: "0033A0" })], spacing: { before: 300 } }),
        new Paragraph({ children: [new TextRun({ text: "Relevant CLOs, MLO, & Associated Assessments/Activities", bold: true })] }),
        ...mod.relevantCLOs.map(clo => new Paragraph({ text: `CLO: ${clo}`, spacing: { after: 50 }, bullet: { level: 0 } })),
        ...mod.relevantMLOs.map(mlo => new Paragraph({ text: `MLO: ${mlo}`, spacing: { after: 50 }, bullet: { level: 0 } })),
        new Paragraph({ children: [new TextRun({ text: "Findings", bold: true })], spacing: { before: 200 } }),
        new Paragraph({ text: mod.findings }),
        new Paragraph({ children: [new TextRun({ text: "Recommendations", bold: true })], spacing: { before: 100 } }),
        new Paragraph({ text: mod.recommendations, spacing: { after: 400 } })
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
