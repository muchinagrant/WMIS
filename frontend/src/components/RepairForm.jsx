import React, { useRef, useState, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Formik, Form, Field, FieldArray } from 'formik';
import * as Yup from 'yup';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios'; 
import { SyncContext } from '../context/SyncContext'; 
import { addToQueue } from '../api/offlineQueue';     
import AuthContext from '../context/AuthContext';

const RepairSchema = Yup.object().shape({
  completion_date: Yup.date().required('Completion date is required'),
  location: Yup.string().required('Location is required'),
  description_of_work: Yup.string().required('Description is required'),
  materials_notes: Yup.string(),
});

const RepairForm = () => {
  const [searchParams] = useSearchParams();
  const incidentId = searchParams.get('incident'); // Grab ID from URL
  
  const sigCanvas = useRef({});
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [createdRepairId, setCreatedRepairId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [parentLocation, setParentLocation] = useState('Fetching location...');
  
  const { isOnline, refreshQueueCount } = useContext(SyncContext);
  const { user } = useContext(AuthContext); 
  const userRole = user?.role || 'attendant';

  // Fetch Parent Incident Location AND Available Materials
  useEffect(() => {
      const fetchSetupData = async () => {
          if (isOnline) {
              try {
                  const matRes = await api.get('/api/materials/');
                  setAvailableMaterials(matRes.data);
                  
                  if (incidentId) {
                      const incRes = await api.get(`/api/incidents/${incidentId}/`);
                      setParentLocation(incRes.data.location_text);
                  } else {
                      setParentLocation('Standalone Repair (No Incident Linked)');
                  }
              } catch (err) {
                  console.error("Could not load setup data", err);
              }
          }
      };
      fetchSetupData();
  }, [incidentId, isOnline]);

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
        setStatusMsg({ type: 'success', message: 'Repair logged! Waiting for supervisor certification.' });
        setCreatedRepairId(newRepairId); 
        setPhotoFile(null);
      } else {
        throw new Error('Network offline');
      }
    } catch (error) {
      if (!navigator.onLine || error.message === 'Network offline') {
        const payload = { ...values, incident: incidentId };
        await addToQueue('/api/repairs/', payload, 'POST', { isRepair: true });
        await refreshQueueCount(); 
        setStatusMsg({ type: 'info', message: 'Repair saved offline. Inventory will sync when connection is restored.' });
        resetForm();
      } else {
        setStatusMsg({ type: 'error', message: error.response?.data?.inventory || 'Failed to submit repair.' });
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
                location: parentLocation, 
                description_of_work: '', 
                materials_notes: '', 
                requisitions: [] 
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
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description of Repairs</label>
                  <Field as="select" name="description_of_work" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', marginBottom: '10px' }}>
                      <option value="">-- Select Standard Action --</option>
                      <option value="Manual Unblocking (Rodding)">Manual Unblocking (Rodding)</option>
                      <option value="High-Pressure Jetting">High-Pressure Jetting</option>
                      <option value="Pipe Section Replacement">Pipe Section Replacement</option>
                      <option value="Manhole Cover Fitting">Manhole Cover Fitting</option>
                      <option value="Sewer Line Benching/Masonry">Sewer Line Benching/Masonry</option>
                  </Field>
                </div>

                {/* DYNAMIC INVENTORY SELECTOR */}
                <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600', color: '#0f172a' }}><i className="fas fa-boxes" style={{ color: '#1a6fb0' }}></i> Material Requisition (Store Inventory)</label>
                    <FieldArray name="requisitions">
                      {({ remove, push }) => (
                        <div>
                          {values.requisitions.map((req, index) => (
                            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                              <Field as="select" name={`requisitions.${index}.material_id`} style={{ flex: 2, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                <option value="">-- Select Material --</option>
                                {availableMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.current_stock} available)</option>)}
                              </Field>
                              <Field type="number" step="0.1" name={`requisitions.${index}.quantity_used`} placeholder="Qty" style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                              <button type="button" onClick={() => remove(index)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px', borderRadius: '4px' }}><i className="fas fa-trash"></i></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => push({ material_id: '', quantity_used: '' })} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px dashed #0284c7', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Material</button>
                        </div>
                      )}
                    </FieldArray>
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Misc Materials / Extra Notes</label>
                  <Field as="textarea" name="materials_notes" placeholder="Off-book materials or extra details..." style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}><i className="fas fa-camera"></i> Attach Evidence Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.currentTarget.files[0])} style={{ width: '100%', padding: '8px', border: '1px dashed #1a6fb0', borderRadius: '6px' }} disabled={!isOnline} />
                </div>

                <button type="submit" disabled={isSubmitting} style={{ background: isOnline ? '#1a6fb0' : '#6c757d', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
                  <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`}></i> {isOnline ? 'Submit Repair & Deduct Inventory' : 'Save Offline'}
                </button>
              </Form>
            )}
          </Formik>
      )}

      {/* Signature Box for Supervisor */}
      {(createdRepairId && ['admin', 'superintendent', 'supervisor'].includes(userRole)) && (
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