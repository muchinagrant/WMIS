import React, { useRef, useState, useContext } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios'; 
import { SyncContext } from '../context/SyncContext'; 
import { addToQueue } from '../api/offlineQueue';     
import AuthContext from '../context/AuthContext';

const RepairSchema = Yup.object().shape({
  completion_date: Yup.date().required('Completion date is required'),
  location: Yup.string().required('Location is required'),
  repair_type: Yup.string().required('Repair type is required'),
  scope_of_work: Yup.string().required('Scope of work is required'),
  materials_used: Yup.string(),
});

const RepairForm = ({ incidentId, locationText, onSuccess }) => {
  const sigCanvas = useRef({});
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [createdRepairId, setCreatedRepairId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  
  const { isOnline, refreshQueueCount } = useContext(SyncContext);
  const { user } = useContext(AuthContext); 
  const userRole = user?.role || 'line_attendant';

  const handleCreateRepair = async (values, { setSubmitting, resetForm }) => {
    setStatusMsg({ type: 'info', message: 'Processing repair submission...' });
    try {
      if (isOnline) {
        const repairPayload = { ...values, incident: incidentId };
        const repairRes = await api.post('/api/repairs/', repairPayload);
        const newRepairId = repairRes.data.id;

        if (photoFile) {
            const photoData = new FormData();
            photoData.append('file', photoFile);
            photoData.append('content_type', 'repair');
            photoData.append('object_id', newRepairId);
            await api.post('/api/attachments/', photoData, { headers: { 'Content-Type': 'multipart/form-data' }});
        }

        if (incidentId) {
          await api.post(`/api/incidents/${incidentId}/update_status/`, { status: 'pending_certification' });
        }

        setStatusMsg({ type: 'success', message: 'Work logged! Task sent to supervisor for certification.' });
        setCreatedRepairId(newRepairId); 
        setPhotoFile(null);
        resetForm();

        if (onSuccess) {
          setTimeout(onSuccess, 1500);
        }
      } else {
        throw new Error('Network offline');
      }
    } catch (error) {
      if (!navigator.onLine || error.message === 'Network offline') {
        const payload = { ...values, incident: incidentId };
        await addToQueue('/api/repairs/', payload, 'POST', { isRepair: true });

        if (incidentId) {
          await addToQueue(`/api/incidents/${incidentId}/update_status/`, { status: 'pending_certification' }, 'POST');
        }

        await refreshQueueCount(); 
        setStatusMsg({ type: 'info', message: 'Repair saved offline. It will sync when connection is restored.' });
        resetForm();

        if (onSuccess) {
          setTimeout(onSuccess, 2000);
        }
      } else {
        setStatusMsg({ type: 'error', message: 'Failed to submit repair.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCertify = async () => {
      if (sigCanvas.current.isEmpty()) return setStatusMsg({ type: 'error', message: 'Please provide a signature.' });
      setStatusMsg({ type: 'info', message: 'Processing digital signature...' });
      const signatureBlob = await new Promise((resolve) => sigCanvas.current.getTrimmedCanvas().toBlob(resolve, 'image/png'));
  
      try {
        if (isOnline && createdRepairId) {
          const formData = new FormData();
          formData.append('supervisor_signature', signatureBlob, 'signature.png');
          await api.patch(`/api/repairs/${createdRepairId}/certify/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          setStatusMsg({ type: 'success', message: 'Repair certified, incident resolved, and SLA closed!' });
          sigCanvas.current.clear();
          setCreatedRepairId(null); 
        }
      } catch (err) {
        setStatusMsg({ type: 'error', message: 'Certification failed.' });
      }
  };

  return (
    <div className="form-section active">
      <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fas fa-tools"></i> Repairs Completion Certificate
      </h2>
      
      {statusMsg.message && (
        <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: statusMsg.type === 'success' ? '#065f46' : '#991b1b' }}>
          {statusMsg.message}
        </div>
      )}

      {!createdRepairId && (
          <Formik 
            enableReinitialize={true}
            initialValues={{ 
                completion_date: new Date().toISOString().split('T')[0], 
                location: locationText || 'Unknown Location', 
              repair_type: 'other',
              scope_of_work: '',
              materials_used: '',
            }} 
            validationSchema={RepairSchema} 
            onSubmit={handleCreateRepair}
          >
            {({ values, isSubmitting }) => (
              <Form>
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date of Completion</label>
                    <Field type="date" name="completion_date" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location (Read-Only) <i className="fas fa-lock" style={{color: '#94a3b8'}}></i></label>
                    <Field type="text" name="location" readOnly style={{ width: '100%', padding: '12px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569' }} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Repair Type</label>
                  <Field as="select" name="repair_type" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', marginBottom: '10px' }}>
                      <option value="other">Other</option>
                      <option value="rodding">Rodding / Unblocking</option>
                      <option value="jetting">High-Pressure Jetting</option>
                      <option value="pipe_replacement">Pipe Replacement</option>
                      <option value="manhole_repair">Manhole / Cover Repair</option>
                  </Field>
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Scope of Work</label>
                  <Field as="textarea" name="scope_of_work" placeholder="Describe the exact work performed..." style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '80px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Materials Used</label>
                  <Field as="textarea" name="materials_used" placeholder="Manually list materials used (e.g., 2 PVC pipes, 1 bag cement)" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}><i className="fas fa-camera"></i> Attach Evidence Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.currentTarget.files[0])} style={{ width: '100%', padding: '8px', border: '1px dashed #1a6fb0', borderRadius: '6px' }} disabled={!isOnline} />
                </div>

                <button type="submit" disabled={isSubmitting} style={{ background: isOnline ? '#1a6fb0' : '#6c757d', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
                  <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`}></i> {isOnline ? 'Submit for Certification' : 'Save Offline'}
                </button>
              </Form>
            )}
          </Formik>
      )}

      {/* Signature Box for Supervisor */}
        {(createdRepairId && ['admin', 'stp_superintendent', 'line_supervisor'].includes(userRole)) && (
          <div className="signature-area" style={{ marginTop: '20px', padding: '25px', background: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1' }}>
             <h3 style={{ color: '#0f172a', marginBottom: '15px' }}><i className="fas fa-file-signature"></i> Supervisor Certification</h3>
             <div style={{ border: '2px solid #94a3b8', borderRadius: '6px', background: 'white', marginBottom: '15px' }}>
                <SignatureCanvas ref={sigCanvas} penColor="darkblue" canvasProps={{ style: { width: '100%', height: '200px' } }} />
             </div>
             <button onClick={handleCertify} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Certify & Close Incident</button>
          </div>
      )}
    </div>
  );
};

export default RepairForm;