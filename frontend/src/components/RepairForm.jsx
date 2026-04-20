import React, { useRef, useState, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios'; 
import { SyncContext } from '../context/SyncContext'; 
import { addToQueue } from '../api/offlineQueue';     
import AuthContext from '../context/AuthContext';

// Validation rules for creating a repair
const RepairSchema = Yup.object().shape({
  completion_date: Yup.date().required('Completion date is required'),
  location: Yup.string().required('Location is required'),
  description_of_work: Yup.string().required('Description is required'),
  materials_used: Yup.string(),
});

const RepairForm = ({ incidentId = null }) => {
  const sigCanvas = useRef({});
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [createdRepairId, setCreatedRepairId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  
  const { isOnline, refreshQueueCount } = useContext(SyncContext);
  const { user } = useContext(AuthContext); // Pull user role dynamically
  const userRole = user?.role || 'attendant';

  // 1. Plumber submits the text data and evidence photo
  const handleCreateRepair = async (values, { setSubmitting, resetForm }) => {
    setStatusMsg({ type: 'info', message: 'Processing repair submission...' });
    
    try {
      if (isOnline) {
        // Step A: Submit the text payload to create the Repair record
        const repairPayload = { ...values, incident: incidentId };
        const repairRes = await api.post('/api/repairs/', repairPayload);
        const newRepairId = repairRes.data.id;

        // Step B: Upload the evidence photo separately to the Attachment model
        if (photoFile) {
            const photoData = new FormData();
            photoData.append('file', photoFile);
            photoData.append('content_type', 'repair');
            photoData.append('object_id', newRepairId);
            
            await api.post('/api/attachments/', photoData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }

        setStatusMsg({ 
          type: 'success', 
          message: 'Repair submitted successfully! Waiting for supervisor certification.' 
        });
        setCreatedRepairId(newRepairId); // Opens the signature box if user is a supervisor
        resetForm();
        setPhotoFile(null);
      } else {
        throw new Error('Network offline');
      }
    } catch (error) {
      if (!navigator.onLine || error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        // Queue the text data for offline sync
        const payload = { ...values, incident: incidentId };
        await addToQueue('/api/repairs/', payload, 'POST', { isRepair: true });
        await refreshQueueCount(); 
        
        setStatusMsg({ type: 'info', message: 'Repair text saved offline. Will sync when connection is restored.' });
        resetForm();
      } else {
        setStatusMsg({ type: 'error', message: error.response?.data?.detail || 'Failed to submit repair.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Supervisor digitally signs the completed repair
  const handleCertify = async () => {
    if (sigCanvas.current.isEmpty()) {
      setStatusMsg({ type: 'error', message: 'Please provide a signature to certify.' });
      return;
    }

    setStatusMsg({ type: 'info', message: 'Processing digital signature...' });
    
    // Convert canvas drawing to an image blob
    const signatureBlob = await new Promise((resolve) => {
      sigCanvas.current.getTrimmedCanvas().toBlob(resolve, 'image/png');
    });

    try {
      if (isOnline && createdRepairId) {
        const formData = new FormData();
        formData.append('supervisor_signature', signatureBlob, 'signature.png');

        // Hit the custom @action endpoint we built in Phase 5
        await api.patch(`/api/repairs/${createdRepairId}/certify/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        setStatusMsg({ type: 'success', message: 'Repair successfully certified and signed!' });
        sigCanvas.current.clear();
        setCreatedRepairId(null); 
      } else {
        setStatusMsg({ type: 'error', message: 'Must be online to securely submit digital signatures.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', message: 'Certification failed: ' + (err.response?.data?.error || err.message) });
    }
  };

  return (
    <div className="form-section active">
      <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fas fa-tools"></i> Repairs Completion Certificate
      </h2>
      
      {!isOnline && (
        <div style={{ padding: '10px', marginBottom: '20px', borderRadius: '6px', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-wifi-slash"></i>
          <span>You are currently offline. Repairs will be saved locally. (Signatures require an active connection).</span>
        </div>
      )}
      
      {statusMsg.message && (
        <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#e8f4fc', color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#1a6fb0' }}>
          <i className={`fas ${statusMsg.type === 'success' ? 'fa-check-circle' : statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} style={{ marginRight: '8px' }}></i>
          {statusMsg.message}
        </div>
      )}

      {/* Hide the main form if a repair was just created and we are waiting for a signature */}
      {!createdRepairId && (
          <Formik initialValues={{ completion_date: new Date().toISOString().split('T')[0], location: '', description_of_work: '', materials_used: '' }} validationSchema={RepairSchema} onSubmit={handleCreateRepair}>
            {({ isSubmitting }) => (
              <Form>
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date of Completion</label>
                    <Field type="date" name="completion_date" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                    <ErrorMessage name="completion_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                    <Field type="text" name="location" placeholder="Repair location details" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                    <ErrorMessage name="location" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description of Repairs</label>
                  <Field as="textarea" name="description_of_work" placeholder="Scope of work performed" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '80px' }} />
                  <ErrorMessage name="description_of_work" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Materials Used</label>
                  <Field as="textarea" name="materials_used" placeholder="List materials used..." style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}><i className="fas fa-camera" style={{ marginRight: '8px' }}></i> Attach Evidence Photo (Optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.currentTarget.files[0])} style={{ width: '100%', padding: '8px', border: '1px dashed #1a6fb0', borderRadius: '6px' }} disabled={!isOnline} />
                </div>

                <button type="submit" disabled={isSubmitting} style={{ background: isOnline ? '#1a6fb0' : '#6c757d', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '600', transition: 'background 0.3s ease' }}>
                  <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i> 
                  {isSubmitting ? 'Processing...' : isOnline ? 'Submit Repair Report' : 'Save Text Offline'}
                </button>
              </Form>
            )}
          </Formik>
      )}

      {/* Signature & Certification Area - ONLY visible to Supervisors after a repair is generated */}
      {(createdRepairId && ['admin', 'superintendent', 'supervisor'].includes(userRole)) && (
        <div className="signature-area" style={{ marginTop: '20px', padding: '25px', background: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1' }}>
          <h3 style={{ color: '#0f172a', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fas fa-file-signature" style={{ color: '#1a6fb0' }}></i> Supervisor Official Certification
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '15px' }}>
            By signing below, you certify that you have inspected the site and the repair has been completed to KICOWASCO standards.
          </p>
          
          <div className="signature-box" style={{ width: '100%' }}>
            <div style={{ border: '2px solid #94a3b8', borderRadius: '6px', background: 'white', marginBottom: '15px', overflow: 'hidden' }}>
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="darkblue"
                canvasProps={{ className: 'sigCanvas', style: { width: '100%', height: '200px', cursor: 'crosshair' } }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => sigCanvas.current.clear()} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <i className="fas fa-eraser"></i> Clear
              </button>
              <button onClick={handleCertify} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <i className="fas fa-check-circle"></i> Certify & Close Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairForm;