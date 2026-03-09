import React, { useState, useEffect, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// 1. Validation Schemas for all three forms
const CollectionSchema = Yup.object().shape({
    collection_date: Yup.date().required('Date is required'),
    source_type: Yup.string().required('Source type is required'),
    volume_m3: Yup.number().min(0, 'Must be positive').required('Volume is required'),
    exhauster: Yup.number().required('Exhauster is required'), // Maps to exhauster ID
});

const ExhausterSchema = Yup.object().shape({
    reg_no: Yup.string().required('Registration is required'),
    owner: Yup.string().required('Owner is required'),
    capacity_m3: Yup.number().min(0.1, 'Capacity must be > 0').required('Capacity is required'),
});

const LicenseSchema = Yup.object().shape({
    exhauster: Yup.number().required('Select an exhauster'),
    start_date: Yup.date().required('Start date is required'),
    end_date: Yup.date()
        .min(Yup.ref('start_date'), 'End date must be after start date')
        .required('End date is required'),
});

const SludgeManifest = () => {
    // State to manage the active sub-tab (Collection, Exhausters, Licenses)
    const [activeSubTab, setActiveSubTab] = useState('collection');
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const [exhausters, setExhausters] = useState([]); // To hold exhauster data from API
    
    // 4. Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // Fetch exhausters on mount and when tabs change to show newly added exhausters
    useEffect(() => {
        const fetchExhausters = async () => {
            try {
                // Using the endpoint from the updated views
                const response = await api.get('/exhausters/');
                // Handle both paginated and non-paginated responses
                setExhausters(response.data.results || response.data);
            } catch (error) {
                console.error("Failed to fetch exhausters", error);
                // Fallback mock data for development
                setExhausters([
                    { id: 1, reg_no: 'KAA 123A', owner: 'John Doe' },
                    { id: 2, reg_no: 'KBB 456B', owner: 'Jane Smith' },
                ]);
            }
        };
        fetchExhausters();
    }, [activeSubTab]); // Refetch if tabs change so newly added exhausters show up

    // 5. Updated offline-capable submit handler for all forms
    const handleGenericSubmit = async (endpoint, values, resetForm, successText, formType) => {
        setStatusMsg({ type: '', text: '' });
        
        try {
            if (isOnline) {
                const response = await api.post(endpoint, values);
                
                if (response.status === 201 || response.status === 200) {
                    setStatusMsg({ type: 'success', text: successText });
                    resetForm();
                }
            } else {
                // Force the catch block if offline
                throw new Error('Network offline');
            }
        } catch (error) {
            // Check if we're offline or if it's a network error
            if (!navigator.onLine || 
                error.message === 'Network Error' || 
                error.message === 'Network offline' ||
                error.code === 'ERR_NETWORK') {
                
                // Save to queue with metadata based on form type
                const metadata = {
                    formType: formType,
                    timestamp: new Date().toISOString()
                };

                // Add form-specific metadata
                switch(formType) {
                    case 'collection':
                        metadata.hasReceivingNotes = !!values.receiving_notes;
                        metadata.toiletsPresent = values.toilets_present;
                        break;
                    case 'exhauster':
                        metadata.hasContact = !!values.contact;
                        break;
                    case 'license':
                        metadata.hasLicenseNo = !!values.license_no;
                        metadata.hasFee = !!values.fee_paid;
                        break;
                    default:
                        break;
                }

                await addToQueue(endpoint, values, 'POST', metadata);
                await refreshQueueCount(); // Update the UI counter
                
                // Custom success message based on form type
                let offlineMessage = '';
                switch(formType) {
                    case 'collection':
                        offlineMessage = 'Collection manifest saved offline. It will sync automatically when connection is restored.';
                        break;
                    case 'exhauster':
                        offlineMessage = 'Exhauster registration saved offline. It will sync automatically when connection is restored.';
                        break;
                    case 'license':
                        offlineMessage = 'License issuance saved offline. It will sync automatically when connection is restored.';
                        break;
                    default:
                        offlineMessage = 'Saved offline. It will sync automatically when connection is restored.';
                        break;
                }
                
                setStatusMsg({ 
                    type: 'info', 
                    text: offlineMessage
                });
                
                // Reset form after offline save
                resetForm();
            } else {
                // Actual API error (validation, server error, etc.)
                setStatusMsg({ 
                    type: 'error', 
                    text: 'Submission failed: ' + (error.response?.data?.detail || error.message)
                });
            }
        }
    };

    // Initial values for each form
    const initialCollectionValues = {
        collection_date: new Date().toISOString().split('T')[0],
        source_name: '',
        source_type: '',
        area_ward: '',
        toilets_present: false,
        volume_m3: '',
        users: '',
        last_emptied: '',
        exhauster: '',
        waste_description: '',
        receiving_notes: ''
    };

    const initialExhausterValues = {
        reg_no: '',
        owner: '',
        capacity_m3: '',
        contact: '',
        date_registered: new Date().toISOString().split('T')[0],
        status: 'active'
    };

    const initialLicenseValues = {
        exhauster: '',
        license_no: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        status: 'valid',
        fee_paid: ''
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-truck"></i> Sludge Manifest & Exhauster Registry
            </h2>

            {/* Offline indicator */}
            {!isOnline && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                        <strong>You are currently offline.</strong> All submissions will be saved locally and synced when connection is restored.
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {statusMsg.text && (
                <div style={{ 
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    color: statusMsg.type === 'error' ? '#991b1b' : 
                           statusMsg.type === 'success' ? '#065f46' : '#856404',
                    backgroundColor: statusMsg.type === 'error' ? '#fee2e2' : 
                                   statusMsg.type === 'success' ? '#d1fae5' : '#fff3cd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className={`fas ${
                        statusMsg.type === 'success' ? 'fa-check-circle' : 
                        statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ fontSize: '1.2rem' }}></i>
                    <div>{statusMsg.text}</div>
                </div>
            )}

            {/* Sub-Tab Navigation - Using the tab class structure from updates */}
            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '25px', 
                borderBottom: '1px solid #d1e5f1', 
                paddingBottom: '10px',
                background: 'transparent',
                border: 'none'
            }}>
                <div 
                    onClick={() => setActiveSubTab('collection')}
                    className={`tab ${activeSubTab === 'collection' ? 'active' : ''}`}
                    data-subtab="collection"
                    style={{ 
                        padding: '10px 20px', 
                        border: 'none', 
                        background: activeSubTab === 'collection' ? '#1a6fb0' : 'transparent', 
                        color: activeSubTab === 'collection' ? 'white' : '#2c3e50', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontWeight: '600' 
                    }}
                >
                    <i className="fas fa-truck-loading" style={{ marginRight: '8px' }}></i> Collection
                </div>
                <div 
                    onClick={() => setActiveSubTab('exhausters')}
                    className={`tab ${activeSubTab === 'exhausters' ? 'active' : ''}`}
                    data-subtab="exhausters"
                    style={{ 
                        padding: '10px 20px', 
                        border: 'none', 
                        background: activeSubTab === 'exhausters' ? '#1a6fb0' : 'transparent', 
                        color: activeSubTab === 'exhausters' ? 'white' : '#2c3e50', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontWeight: '600' 
                    }}
                >
                    <i className="fas fa-truck-moving" style={{ marginRight: '8px' }}></i> Exhauster Registry
                </div>
                <div 
                    onClick={() => setActiveSubTab('licenses')}
                    className={`tab ${activeSubTab === 'licenses' ? 'active' : ''}`}
                    data-subtab="licenses"
                    style={{ 
                        padding: '10px 20px', 
                        border: 'none', 
                        background: activeSubTab === 'licenses' ? '#1a6fb0' : 'transparent', 
                        color: activeSubTab === 'licenses' ? 'white' : '#2c3e50', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontWeight: '600' 
                    }}
                >
                    <i className="fas fa-id-card" style={{ marginRight: '8px' }}></i> Licenses
                </div>
            </div>

            {/* 1. COLLECTION MANIFEST TAB */}
            {activeSubTab === 'collection' && (
                <div className="sub-section active">
                    <Formik
                        initialValues={initialCollectionValues}
                        validationSchema={CollectionSchema}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            handleGenericSubmit(
                                '/sludge-collections/', 
                                values, 
                                resetForm, 
                                'Manifest completed successfully!',
                                'collection'
                            ).finally(() => setSubmitting(false));
                        }}
                    >
                        {({ isSubmitting, values }) => (
                            <Form>
                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date of Collection</label>
                                        <Field 
                                            type="date" 
                                            name="collection_date" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="collection_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Source Type</label>
                                        <Field 
                                            as="select" 
                                            name="source_type" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}
                                            disabled={isSubmitting}
                                        >
                                            <option value="">Select Type</option>
                                            <option value="residential">Residential</option>
                                            <option value="institutional">Institutional</option>
                                            <option value="commercial">Commercial/Industrial</option>
                                        </Field>
                                        <ErrorMessage name="source_type" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                </div>

                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Name (Plot/Institution)</label>
                                        <Field 
                                            type="text" 
                                            name="source_name" 
                                            placeholder="Source identification" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Area/Ward</label>
                                        <Field 
                                            type="text" 
                                            name="area_ward" 
                                            placeholder="Location details" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Volume (m³)</label>
                                        <Field 
                                            type="number" 
                                            step="0.1" 
                                            name="volume_m3" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="volume_m3" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Exhauster Used</label>
                                        <Field 
                                            as="select" 
                                            name="exhauster" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}
                                            disabled={isSubmitting}
                                        >
                                            <option value="">Select Registered Exhauster</option>
                                            {exhausters.map(ex => (
                                                <option key={ex.id} value={ex.id}>{ex.reg_no} ({ex.owner})</option>
                                            ))}
                                        </Field>
                                        <ErrorMessage name="exhauster" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600' }}>
                                        <Field 
                                            type="checkbox" 
                                            name="toilets_present" 
                                            disabled={isSubmitting}
                                        />
                                        Toilets Present on Site?
                                    </label>
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Receiving Notes (Ahiti Domba)</label>
                                    <Field 
                                        as="textarea" 
                                        name="receiving_notes" 
                                        placeholder="Volume verification, quality observations..." 
                                        style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '80px' }}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn"
                                    disabled={isSubmitting}
                                    style={{ 
                                        background: isOnline ? '#1a6fb0' : '#6c757d', 
                                        color: 'white', 
                                        border: 'none', 
                                        padding: '12px 25px', 
                                        borderRadius: '6px', 
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                        fontSize: '15px', 
                                        fontWeight: '600', 
                                        opacity: isSubmitting ? 0.7 : 1,
                                        transition: 'background 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <i className={`fas ${isOnline ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}></i> 
                                    {isSubmitting 
                                        ? 'Saving...' 
                                        : isOnline 
                                            ? 'Complete Manifest' 
                                            : 'Save Offline'
                                    }
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            )}

            {/* 2. EXHAUSTER REGISTRY TAB */}
            {activeSubTab === 'exhausters' && (
                <div className="sub-section active">
                    <h3 style={{ margin: '0 0 20px 0', color: '#1a6fb0', fontSize: '1.2rem' }}>Register New Exhauster</h3>
                    <Formik
                        initialValues={initialExhausterValues}
                        validationSchema={ExhausterSchema}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            handleGenericSubmit(
                                '/exhausters/', 
                                values, 
                                resetForm, 
                                'Exhauster registered successfully!',
                                'exhauster'
                            ).finally(() => setSubmitting(false));
                        }}
                    >
                        {({ isSubmitting }) => (
                            <Form>
                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Registration No.</label>
                                        <Field 
                                            type="text" 
                                            name="reg_no" 
                                            placeholder="e.g., KXX 123X" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="reg_no" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Owner Name</label>
                                        <Field 
                                            type="text" 
                                            name="owner" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="owner" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                </div>

                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Capacity (m³)</label>
                                        <Field 
                                            type="number" 
                                            step="0.1" 
                                            name="capacity_m3" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="capacity_m3" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Contact Phone</label>
                                        <Field 
                                            type="text" 
                                            name="contact" 
                                            placeholder="Optional" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '25px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Registration Date</label>
                                    <Field 
                                        type="date" 
                                        name="date_registered" 
                                        style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn"
                                    disabled={isSubmitting}
                                    style={{ 
                                        background: isOnline ? '#1a6fb0' : '#6c757d', 
                                        color: 'white', 
                                        border: 'none', 
                                        padding: '12px 25px', 
                                        borderRadius: '6px', 
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                        fontSize: '15px', 
                                        fontWeight: '600', 
                                        opacity: isSubmitting ? 0.7 : 1,
                                        transition: 'background 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <i className={`fas ${isOnline ? 'fa-save' : 'fa-cloud-upload-alt'}`}></i> 
                                    {isSubmitting 
                                        ? 'Saving...' 
                                        : isOnline 
                                            ? 'Register Vehicle' 
                                            : 'Save Offline'
                                    }
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            )}

            {/* 3. LICENSES TAB */}
            {activeSubTab === 'licenses' && (
                <div className="sub-section active">
                    <h3 style={{ margin: '0 0 20px 0', color: '#1a6fb0', fontSize: '1.2rem' }}>Issue Operating License</h3>
                    <Formik
                        initialValues={initialLicenseValues}
                        validationSchema={LicenseSchema}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            handleGenericSubmit(
                                '/licenses/', 
                                values, 
                                resetForm, 
                                'License issued successfully!',
                                'license'
                            ).finally(() => setSubmitting(false));
                        }}
                    >
                        {({ isSubmitting }) => (
                            <Form>
                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Select Exhauster</label>
                                        <Field 
                                            as="select" 
                                            name="exhauster" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}
                                            disabled={isSubmitting}
                                        >
                                            <option value="">Select Exhauster</option>
                                            {exhausters.map(ex => (
                                                <option key={ex.id} value={ex.id}>{ex.reg_no} - {ex.owner}</option>
                                            ))}
                                        </Field>
                                        <ErrorMessage name="exhauster" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>License Number</label>
                                        <Field 
                                            type="text" 
                                            name="license_no" 
                                            placeholder="LIC-XXXX" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Start Date</label>
                                        <Field 
                                            type="date" 
                                            name="start_date" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="start_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>End Date</label>
                                        <Field 
                                            type="date" 
                                            name="end_date" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="end_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '25px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Fee Paid (Optional)</label>
                                    <Field 
                                        type="number" 
                                        step="0.01" 
                                        name="fee_paid" 
                                        placeholder="Amount paid" 
                                        style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn"
                                    disabled={isSubmitting}
                                    style={{ 
                                        background: isOnline ? '#1a6fb0' : '#6c757d', 
                                        color: 'white', 
                                        border: 'none', 
                                        padding: '12px 25px', 
                                        borderRadius: '6px', 
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                        fontSize: '15px', 
                                        fontWeight: '600', 
                                        opacity: isSubmitting ? 0.7 : 1,
                                        transition: 'background 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <i className={`fas ${isOnline ? 'fa-file-export' : 'fa-cloud-upload-alt'}`}></i> 
                                    {isSubmitting 
                                        ? 'Saving...' 
                                        : isOnline 
                                            ? 'Issue License' 
                                            : 'Save Offline'
                                    }
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            )}

        </div>
    );
};

export default SludgeManifest;