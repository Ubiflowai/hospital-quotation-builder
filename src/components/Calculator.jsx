import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE ---
  const [rows, setRows] = useState([]); // Flat list of selected items
  const [categoryOrder, setCategoryOrder] = useState([]); // IDs of categories in display order
  
  // Header Meta
  const [quoteNo, setQuoteNo] = useState("397");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0,10));
  const [buyerName, setBuyerName] = useState("Govt Medical College Hospital Thrissur");
  const [buyerAddress, setBuyerAddress] = useState("Kerala, Code: 32");
  
  // View & PDF
  const [isClientMode, setIsClientMode] = useState(false);
  const pdfRef = useRef();

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- 1. ADD / REMOVE ITEMS ---

  const addRow = (productId, categoryId) => {
    // Find category and item
    const category = productCatalog.find(c => c.id === categoryId);
    const product = category?.items.find(p => p.id === productId);
    
    if (!product) return;

    // Check if category is already in the order list, if not add it
    if (!categoryOrder.includes(categoryId)) {
        setCategoryOrder([...categoryOrder, categoryId]);
    }

    // DEFAULT VALUES
    const factoryPrice = product.factoryPrice;
    const transPercent = 2; // Default 2%
    const transAmt = factoryPrice * (transPercent / 100);
    const workCost = 0;
    const fittingCost = 0;
    const saddleCost = 0;
    
    // Internal Cost
    const internalCost = factoryPrice + transAmt + workCost + fittingCost + saddleCost;
    
    // Margin
    const marginPercent = 20; // Default 20%
    const marginAmt = internalCost * (marginPercent / 100);
    
    // Total Per Unit (Cost + Margin)
    const totalPerUnit = internalCost + marginAmt;
    
    // Quoted (Default to Calculated Total)
    const quotedPrice = parseFloat(totalPerUnit.toFixed(2));

    const newRow = {
      uid: Date.now(), // Unique ID for this row instance
      id: product.id,  // Product ID from catalog
      categoryId: categoryId,
      name: product.name,
      hsn: "9018",
      unit: product.unit,
      qty: 1,
      
      // COLUMNS
      factoryPrice: factoryPrice,
      
      transPercent: transPercent,
      transAmt: transAmt,
      
      fittingCost: fittingCost,
      saddleCost: saddleCost,
      workCost: workCost,
      
      // internalCost is dynamic, not stored state (derived)
      
      marginPercent: marginPercent,
      marginAmt: marginAmt,
      
      // totalPerUnit is dynamic
      
      quotedPrice: quotedPrice,
      // profit is dynamic
    };

    setRows([...rows, newRow]);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeRow = (uid) => {
    const updatedRows = rows.filter(r => r.uid !== uid);
    setRows(updatedRows);
    
    // Optional: Remove category from order if no items left? 
    // Usually better to keep it unless explicitly removed, but let's leave it for now.
  };

  // --- 2. COMPLEX UPDATE LOGIC ---

  const updateRow = (uid, field, value) => {
    const val = value === '' ? 0 : parseFloat(value);
    
    setRows(rows.map(row => {
        if (row.uid !== uid) return row;

        const newRow = { ...row };
        
        // 1. FACTORY PRICE (Fixed mostly, but if logic needed)
        
        // 2. TRANSPORT LOGIC
        if (field === 'transPercent') {
            newRow.transPercent = val;
            newRow.transAmt = newRow.factoryPrice * (val / 100);
        } else if (field === 'transAmt') {
            newRow.transAmt = val;
            newRow.transPercent = newRow.factoryPrice > 0 ? (val / newRow.factoryPrice) * 100 : 0;
        } 
        
        // 3. OTHER COSTS
        if (['fittingCost', 'saddleCost', 'workCost'].includes(field)) {
            newRow[field] = val;
        }

        // --- INTERMEDIATE CALC: INTERNAL COST ---
        // We recalculate this to determine Margin
        const internalCost = newRow.factoryPrice + newRow.transAmt + newRow.fittingCost + newRow.saddleCost + newRow.workCost;

        // 4. MARGIN LOGIC
        if (field === 'marginPercent') {
            newRow.marginPercent = val;
            newRow.marginAmt = internalCost * (val / 100);
        } else if (field === 'marginAmt') {
            newRow.marginAmt = val;
            newRow.marginPercent = internalCost > 0 ? (val / internalCost) * 100 : 0;
        } 
        // If costs changed (trans, work etc), we need to update Margin Amount based on FIXED Percent? 
        // OR Keep Amount fixed and change Percent?
        // Standard: Keep Percent Fixed.
        else if (['transPercent', 'transAmt', 'fittingCost', 'saddleCost', 'workCost'].includes(field)) {
             newRow.marginAmt = internalCost * (newRow.marginPercent / 100);
        }

        // 5. QUOTED PRICE & QTY
        if (field === 'quotedPrice') newRow.quotedPrice = val;
        if (field === 'qty') newRow.qty = val;

        // NOTE: "Total Per Unit" and "Profit" are derived during render or saved if needed.
        // We generally don't need to save them if they are purely calculated.
        
        return newRow;
    }));
  };

  // --- 3. REORDER CATEGORIES ---
  const moveCategory = (index, direction) => {
    const newOrder = [...categoryOrder];
    if (direction === 'up' && index > 0) {
        [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setCategoryOrder(newOrder);
  };

  // --- 4. FLATTENED SEARCH LIST ---
  const searchResults = [];
  if (searchTerm.length > 0) {
    productCatalog.forEach(cat => {
        cat.items.forEach(item => {
            if (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                searchResults.push({
                    categoryId: cat.id,
                    categoryName: cat.name,
                    ...item
                });
            }
        });
    });
  }

  // --- 5. CALCULATE TOTALS ---
  const grandTotal = rows.reduce((sum, r) => sum + (r.qty * r.quotedPrice), 0);

  // --- 6. PDF ---
  const handleDownloadPDF = () => {
    setIsClientMode(true);
    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ margin: 5, filename: `Quote_${quoteNo}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save()
        .then(() => setIsClientMode(false));
    }, 500);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', minWidth: '1400px', backgroundColor: '#f5f5f5' }}>
      
      {/* HEADER CONTROLS */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Quotation Builder</h2>
        <div>
            <button onClick={() => setIsClientMode(!isClientMode)} style={{ marginRight: '10px', padding: '8px 15px', background: isClientMode ? '#28a745' : '#ffc107', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                {isClientMode ? "Client View Active" : "Internal View"}
            </button>
            <button onClick={handleDownloadPDF} style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                Download PDF
            </button>
        </div>
      </div>

      {/* SEARCH BAR (Internal Only) */}
      {!isClientMode && (
        <div ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
            <input 
                type="text" 
                placeholder="Search Item (e.g. 'Copper 10mm')..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px' }}
            />
            {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', zIndex: 1000, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                    {searchResults.map((item, idx) => (
                        <div key={idx} onClick={() => addRow(item.id, item.categoryId)} 
                             style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                             onMouseEnter={(e) => e.currentTarget.style.background = '#f0f8ff'}
                             onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                            <div>
                                <span style={{ fontWeight: 'bold', display:'block', fontSize:'12px', color:'#666' }}>{item.categoryName}</span>
                                <span style={{ fontSize: '14px' }}>{item.name}</span>
                            </div>
                            <div style={{ color: '#888' }}>₹{item.factoryPrice}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* --- MAIN QUOTATION DOCUMENT --- */}
      <div ref={pdfRef} style={{ background: 'white', padding: '40px', boxShadow: '0 0 20px rgba(0,0,0,0.1)', minHeight: '800px' }}>
        
        {/* LETTERHEAD */}
        <div style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
                <h1 style={{ margin: '0', color: '#004085', fontSize: '24px' }}>UNITED BIOMEDICAL SERVICES</h1>
                <p style={{ fontSize: '12px', color: '#555', margin: '5px 0' }}>Calicut, Kerala | Ph: 0495 2301999</p>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0 }}>QUOTATION</h3>
                <div style={{ fontSize: '13px', marginTop: '5px' }}>
                    Quote #: <input value={quoteNo} onChange={e => setQuoteNo(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #ccc', textAlign: 'right', width: '60px' }} />
                </div>
                <div style={{ fontSize: '13px' }}>
                    Date: <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #ccc', textAlign: 'right' }} />
                </div>
            </div>
        </div>

        {/* CUSTOMER INFO */}
        <div style={{ marginBottom: '30px', display: 'flex', gap: '40px' }}>
            <div style={{ flex: 1 }}>
                <strong style={{ display:'block', marginBottom:'5px', fontSize:'12px', color:'#888' }}>BILL TO:</strong>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)} style={{ width: '100%', fontWeight: 'bold', fontSize: '16px', border: '1px solid #eee', padding: '5px' }} />
                <textarea value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #eee', padding: '5px', height: '60px', fontFamily:'inherit' }} />
            </div>
        </div>

        {/* --- TABLE START --- */}
        <div style={{ fontSize: '11px' }}>
            {/* TABLE HEADER */}
            <div style={{ display: 'grid', gridTemplateColumns: isClientMode ? '40px 4fr 1fr 1fr 1fr 1.5fr' : '30px 200px 50px 60px 60px 60px 60px 60px 60px 60px 60px 60px 70px 80px 70px 70px 80px', background: '#333', color: 'white', fontWeight: 'bold', padding: '8px 0', textAlign: 'center' }}>
                <div>SI</div>
                <div style={{ textAlign: 'left', paddingLeft:'5px' }}>Description</div>
                {!isClientMode && (
                    <>
                        <div>Fact.</div>
                        <div>Trn%</div>
                        <div>TrnAmt</div>
                        <div>Fit</div>
                        <div>Sadl</div>
                        <div>Work</div>
                        <div style={{background:'#555'}}>Cost</div>
                        <div>Mrg%</div>
                        <div>MrgAmt</div>
                        <div style={{background:'#555'}}>T/Unit</div>
                    </>
                )}
                <div>Qty</div>
                <div>Unit</div>
                <div>Rate</div>
                <div>Amount</div>
                {!isClientMode && (
                    <>
                        <div style={{background:'#28a745'}}>Profit</div>
                        <div style={{background:'#218838'}}>Gross</div>
                        <div>Del</div>
                    </>
                )}
            </div>

            {/* CATEGORY LOOPS */}
            {categoryOrder.map((catId, catIndex) => {
                const category = productCatalog.find(c => c.id === catId);
                const categoryRows = rows.filter(r => r.categoryId === catId);
                
                if (categoryRows.length === 0 && isClientMode) return null; // Hide empty categories in Client Mode

                return (
                    <div key={catId} style={{ marginTop: '10px' }}>
                        {/* CATEGORY HEADER */}
                        <div style={{ background: '#e9ecef', padding: '5px 10px', fontWeight: 'bold', borderBottom: '2px solid #ccc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{color:'#004085', textTransform:'uppercase'}}>{category?.name || "Unknown Category"}</span>
                            {!isClientMode && (
                                <div>
                                    <button onClick={() => moveCategory(catIndex, 'up')} style={{ cursor:'pointer', marginRight:'5px' }}>⬆</button>
                                    <button onClick={() => moveCategory(catIndex, 'down')} style={{ cursor:'pointer' }}>⬇</button>
                                </div>
                            )}
                        </div>

                        {/* ITEMS */}
                        {categoryRows.map((row, index) => {
                            // CALCULATIONS ON THE FLY FOR RENDER
                            const internalCost = row.factoryPrice + row.transAmt + row.fittingCost + row.saddleCost + row.workCost;
                            const totalPerUnit = internalCost + row.marginAmt; // Cost + Margin
                            
                            // User defined "Profit" as Quoted - TotalPerUnit (Excess Profit)
                            // OR Quoted - InternalCost (True Profit).
                            // Let's use Quoted - TotalPerUnit as requested ("profit margin per unit is the quoted price - total per unit")
                            const profitPerUnit = row.quotedPrice - totalPerUnit;
                            const totalGross = profitPerUnit * row.qty;
                            const rowAmount = row.qty * row.quotedPrice;

                            return (
                                <div key={row.uid} style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: isClientMode ? '40px 4fr 1fr 1fr 1fr 1.5fr' : '30px 200px 50px 60px 60px 60px 60px 60px 60px 60px 60px 60px 70px 80px 70px 70px 80px',
                                    padding: '5px 0', 
                                    borderBottom: '1px solid #eee', 
                                    textAlign: 'right',
                                    alignItems: 'center',
                                    background: index % 2 === 0 ? 'white' : '#f9f9f9'
                                }}>
                                    <div style={{ textAlign: 'center' }}>{index + 1}</div>
                                    <div style={{ textAlign: 'left', paddingLeft:'5px' }}>{row.name}</div>
                                    
                                    {!isClientMode && (
                                        <>
                                            <div style={{color:'#888'}}>{row.factoryPrice.toFixed(0)}</div>
                                            <div><input type="number" value={row.transPercent} onChange={(e)=>updateRow(row.uid, 'transPercent', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div><input type="number" value={row.transAmt.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'transAmt', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            
                                            <div><input type="number" value={row.fittingCost} onChange={(e)=>updateRow(row.uid, 'fittingCost', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div><input type="number" value={row.saddleCost} onChange={(e)=>updateRow(row.uid, 'saddleCost', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div><input type="number" value={row.workCost} onChange={(e)=>updateRow(row.uid, 'workCost', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            
                                            <div style={{fontWeight:'bold', color:'#555'}}>{internalCost.toFixed(0)}</div>
                                            
                                            <div><input type="number" value={row.marginPercent} onChange={(e)=>updateRow(row.uid, 'marginPercent', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div><input type="number" value={row.marginAmt.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'marginAmt', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            
                                            <div style={{fontWeight:'bold', color:'#000'}}>{totalPerUnit.toFixed(0)}</div>
                                        </>
                                    )}

                                    {/* QTY */}
                                    <div>
                                        {isClientMode ? row.qty : <input type="number" value={row.qty} onChange={(e)=>updateRow(row.uid, 'qty', e.target.value)} style={{width:'100%', textAlign:'center', border:'1px solid #ddd'}} />}
                                    </div>
                                    <div style={{textAlign:'center'}}>{row.unit}</div>

                                    {/* RATE (QUOTED) */}
                                    <div>
                                        {isClientMode ? row.quotedPrice.toFixed(2) : <input type="number" value={row.quotedPrice} onChange={(e)=>updateRow(row.uid, 'quotedPrice', e.target.value)} style={{width:'100%', textAlign:'right', fontWeight:'bold', border:'1px solid #ddd'}} />}
                                    </div>

                                    {/* AMOUNT */}
                                    <div style={{fontWeight:'bold'}}>{rowAmount.toLocaleString('en-IN')}</div>

                                    {/* PROFITS */}
                                    {!isClientMode && (
                                        <>
                                            <div style={{color: profitPerUnit < 0 ? 'red' : 'green'}}>{profitPerUnit.toFixed(0)}</div>
                                            <div style={{color: totalGross < 0 ? 'red' : 'green', fontWeight:'bold'}}>{totalGross.toFixed(0)}</div>
                                            <div style={{textAlign:'center'}}><button onClick={()=>removeRow(row.uid)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>x</button></div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        {/* --- TABLE END --- */}

        {/* FOOTER TOTALS */}
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #ccc' }}>
                    <span>Sub Total:</span>
                    <strong>₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #ccc' }}>
                    <span>GST (18%):</span>
                    <span>₹{(grandTotal * 0.18).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#333', color: 'white', fontWeight: 'bold' }}>
                    <span>GRAND TOTAL:</span>
                    <span>₹{(grandTotal * 1.18).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}