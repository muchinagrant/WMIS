import React, { useRef, useState, useContext, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage, FieldArray } from 'formik';
import * as Yup from 'yup';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios'; 
import { SyncContext } from '../context/SyncContext'; 
import { addToQueue } from '../api/offlineQueue';     
import AuthContext from '../context/AuthContext';

// UPGRADED: Validation rules now strictly check inventory inputs
const RepairSchema = Yup.object().shape({
  completion_date: Yup.date().required('Completion date is required'),
  location: Yup.string().required('Location is required'),
  description_of_work: Yup.string().required('Description is required'),
  materials_notes: Yup.string(),
  requisitions: Yup.array().of(
    Yup.object().shape({
      material_id: Yup.number().required('Required'),
      quantity_used: Yup.number().min(0.1, 'Must be > 0').required('Required')
    })
  )
});

const RepairForm = ({ incidentId = null }) => {
  const sigCanvas = useRef({});
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [createdRepairId, setCreatedRepairId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [availableMaterials, setAvailableMaterials] = useState([]); // NEW: Inventory State
  
  const { isOnline, refreshQueueCount } = useContext(SyncContext);
  const { user } = useContext(AuthContext); 
  const userRole = user?.role || 'attendant';

  // NEW: Fetch warehouse inventory on load
  useEffect(() => {
      const fetchMaterials = async () => {
          try {
              const res = await api.get('/api/materials/');
              setAvailableMaterials(res.data);
          } catch (err) {
              console.error("Could not load inventory", err);
          }
      };
      if (isOnline) fetchMaterials();
  }, [isOnline]);

  const handleCreateRepair = async (values, { setSubmitting, resetForm }) => {
    setStatusMsg({ type: 'info', message: 'Processing repair submission and deducting inventory...' });
    
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

        setStatusMsg({ type: 'success', message: 'Repair & Inventory logged successfully! Waiting for supervisor certification.' });
        setCreatedRepairId(newRepairId); // Opens the signature box if user is a supervisor
        resetForm();
        setPhotoFile(null);
      } else {
        throw new Error('Network offline');
      }
    } catch (error) {
      if (!navigator.onLine || error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        const payload = { ...values, incident: incidentId };
        await addToQueue('/api/repairs/', payload, 'POST', { isRepair: true });
        await refreshQueueCount(); 
        
        setStatusMsg({ type: 'info', message: 'Repair saved offline. Inventory will sync when connection is restored.' });
        resetForm();
      } else {
        // UPGRADED: Catches strict inventory validation errors from Django
        const errorDetail = error.response?.data?.inventory || error.response?.data?.detail || 'Failed to submit repair.';
        setStatusMsg({ type: 'error', message: errorDetail });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCertify = async () => {
    if (sigCanvas.current.isEmpty()) {
      setStatusMsg({ type: 'error', message: 'Please provide a signature to certify.' });
      return;
    }

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

      {!createdRepairId && (
          <Formik 
            initialValues={{ 
                completion_date: new Date().toISOString().split('T')[0], 
                location: '', 
                description_of_work: '', 
                materials_notes: '', 
                requisitions: [] // NEW: Array for dynamic inventory
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

                {/* --- NEW: DYNAMIC INVENTORY SELECTOR --- */}
                <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600', color: '#0f172a' }}>
                        <i className="fas fa-boxes" style={{ marginRight: '8px', color: '#1a6fb0' }}></i> 
                        Material Requisition (Inventory Deduction)
                    </label>
                    
                    <FieldArray name="requisitions">
                      {({ remove, push }) => (
                        <div>
                          {values.requisitions.length > 0 && values.requisitions.map((req, index) => (
                            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                              <Field as="select" name={`requisitions.${index}.material_id`} style={{ flex: 2, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                <option value="">-- Select Material from Store --</option>
                                {availableMaterials.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.current_stock} {m.unit_of_measure} left)</option>
                                ))}
                              </Field>
                              
                              <Field type="number" step="0.1" name={`requisitions.${index}.quantity_used`} placeholder="Qty" style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                              
                              <button type="button" onClick={() => remove(index)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => push({ material_id: '', quantity_used: '' })} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px dashed #0284c7', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            <i className="fas fa-plus"></i> Add Material
                          </button>
                        </div>
                      )}
                    </FieldArray>
                </div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Misc Materials / Notes</label>
                  <Field as="textarea" name="materials_notes" placeholder="Off-book materials or notes..." style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                  <ErrorMessage name="materials_notes" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: '25px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}><i className="fas fa-camera" style={{ marginRight: '8px' }}></i> Attach Evidence Photo (Optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.currentTarget.files[0])} style={{ width: '100%', padding: '8px', border: '1px dashed #1a6fb0', borderRadius: '6px' }} disabled={!isOnline} />
                </div>

                <button type="submit" disabled={isSubmitting} style={{ background: isOnline ? '#1a6fb0' : '#6c757d', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '600', transition: 'background 0.3s ease' }}>
                  <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i> 
                  {isSubmitting ? 'Processing...' : isOnline ? 'Submit Repair & Deduct Inventory' : 'Save Offline'}
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