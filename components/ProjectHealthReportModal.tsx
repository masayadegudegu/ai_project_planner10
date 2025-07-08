
import React from 'react';
import { ProjectHealthReport } from '../types';
import { XIcon, CheckCircleIcon, ExclamationTriangleIcon, LightBulbIcon } from './icons';

interface ProjectHealthReportModalProps {
  report: ProjectHealthReport | null;
  onClose: () => void;
}

const statusStyles = {
    'On Track': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: <CheckCircleIcon className="w-12 h-12 text-green-500" />
    },
    'At Risk': {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        icon: <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500" />
    },
    'Off Track': {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: <ExclamationTriangleIcon className="w-12 h-12 text-red-500" />
    },
    'Unknown': {
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-800',
        icon: <ExclamationTriangleIcon className="w-12 h-12 text-slate-500" />
    }
};


const ProjectHealthReportModal: React.FC<ProjectHealthReportModalProps> = ({ report, onClose }) => {
  if (!report) return null;

  const currentStatus = statusStyles[report.overallStatus] || statusStyles['Unknown'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-xl font-bold text-slate-800">AIプロジェクト診断レポート</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="w-6 h-6 text-slate-500" /></button>
        </header>

        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          <section className={`p-6 rounded-lg flex items-center gap-6 ${currentStatus.bgColor}`}>
            <div className="flex-shrink-0">{currentStatus.icon}</div>
            <div>
              <h4 className={`text-2xl font-bold ${currentStatus.textColor}`}>{report.overallStatus}</h4>
              <p className={`mt-1 text-base ${currentStatus.textColor}`}>{report.summary}</p>
            </div>
          </section>

          <section>
            <h5 className="text-lg font-semibold text-slate-700 mb-3 flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2 text-green-500"/>うまくいっている点</h5>
            <ul className="list-disc list-inside space-y-2 text-slate-600 pl-2">
              {report.positivePoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </section>

          <section>
            <h5 className="text-lg font-semibold text-slate-700 mb-3 flex items-center"><ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-500"/>懸念事項</h5>
            <div className="space-y-3">
              {report.areasOfConcern.map((concern, index) => (
                <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                  <p className="font-semibold text-yellow-800">{concern.description}</p>
                  {concern.relatedTaskIds.length > 0 && <p className="text-xs text-yellow-700 mt-1">関連タスクID: {concern.relatedTaskIds.join(', ')}</p>}
                </div>
              ))}
            </div>
          </section>
          
          <section>
            <h5 className="text-lg font-semibold text-slate-700 mb-3 flex items-center"><LightBulbIcon className="w-5 h-5 mr-2 text-blue-500"/>AIからの提案</h5>
             <div className="space-y-3">
              {report.suggestions.map((suggestion, index) => (
                <div key={index} className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                  <p className="text-blue-800">{suggestion}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
        <footer className="p-4 bg-slate-50 border-t flex justify-end">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-slate-600 rounded-md hover:bg-slate-700">閉じる</button>
        </footer>
      </div>
    </div>
  );
};

export default ProjectHealthReportModal;