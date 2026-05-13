import React from 'react';

const LabRecordsPlaceholder = () => (
    <div className="form-section active" style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px' }}>
        <h2 style={{ color: '#1a6fb0', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #e0f0fa' }}>
            <i className="fas fa-flask"></i> Daily Lab Records
        </h2>
        <div style={{ background: '#fff7ed', color: '#9a3412', padding: '15px', borderRadius: '8px', border: '1px solid #fdba74' }}>
            <strong>Module not yet active.</strong> Lab records will appear here once the Daily Lab Record module is deployed.
        </div>
    </div>
);

export default LabRecordsPlaceholder;
