import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE ---
  const [rows, setRows] = useState([]); 
  const [categoryOrder, setCategoryOrder] = useState([]); 
  
  // GLOBAL DRIVERS
  const [baseMarginPercent, setBaseMarginPercent] = useState(20);
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProjectValue, setGrandTotalProjectValue] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);

  // HEADER META
  const [quoteNo, setQuoteNo] = useState("397");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0,10));
  const [buyerName, setBuyerName] = useState("Govt Medical College Hospital Thrissur");
  const [buyerAddress, setBuyerAddress] = useState("Kerala, Code: 32");
  
  // VIEW
  const [isClientMode, setIsClientMode] = useState(false);
  const pdfRef = useRef();

  // SEARCH
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- HELPER: ROW MATH ---
  const calculateRow = (row, overrideMargin = null) => {
    const marginPct = overrideMargin !== null ? overrideMargin : row.marginPercent;
    
    // 1. Costs
    const transAmt = row.factoryPrice * (row.transPercent / 100);
    const internalCost = row.factoryPrice + transAmt + row.fittingCost + row.saddleCost + row.workCost;
    
    // 2. Margin Amount (Based on Internal Cost)
    const marginAmt = internalCost * (marginPct / 100);
    
    // 3. Price
    // If the row has a "locked" Quoted Price (manually edited), we might respect that, 
    // BUT for global margin changes, we usually overwrite it. 
    // Here we calculate the "Standard Price" based on margin.
    const calculatedPrice = internalCost + marginAmt;
    
    return {
        ...row,
        transAmt,
        internalCost,
        marginPercent: marginPct,
        marginAmt,
        quotedPrice: parseFloat(calculatedPrice.toFixed(2)) 
    };
  };

  // --- 1. ADD / REMOVE ---
  const addRow = (productId, categoryId) => {
    const category = productCatalog.find(c => c.id === categoryId);
    const product = category?.items.find(p => p.id === productId);
    if (!product) return;

    if (!categoryOrder.includes(categoryId)) {
        setCategoryOrder([...categoryOrder, categoryId]);
    }

    const newRowRaw = {
      uid: Date.now(),
      id: product.id,
      categoryId: categoryId,
      name: product.name,
      hsn: "9018",
      unit: product.unit,
      qty: 1,
      factoryPrice: product.factoryPrice,
      transPercent: 2,
      fittingCost: 0,
      saddleCost: 0,
      workCost: 0,
      marginPercent: baseMarginPercent, // Inherit global margin
    };

    // Calculate derived fields
    const newRow = calculateRow(newRowRaw, baseMarginPercent);
    setRows([...rows, newRow]);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeRow = (uid) => {
    setRows(rows.filter(r => r.uid !== uid));
  };

  // --- 2. UPDATES (Single Row) ---
  const updateRow = (uid, field, value) => {
    const val = value === '' ? 0 : parseFloat(value);
    
    setRows(rows.map(row => {
        if (row.uid !== uid) return row;
        
        const updated = { ...row, [field]: val };

        // Special Logic for specific fields
        if (field === 'transPercent') {
             // Recalculate will handle transAmt
        } 
        else if (field === 'transAmt') {
             // Reverse calc percent
             updated.transPercent = row.factoryPrice > 0 ? (val / row.factoryPrice) * 100 : 0;
        }
        else if (field === 'marginPercent') {
            // Updating margin directly for this row
            // Note: This makes this row deviate from "Base Margin", which is fine
        }
        else if (field === 'quotedPrice') {
            // Reverse engineering margin?
            // Or just letting it sit? 
            // Usually if I type Price, I want Margin to update
            const internalCost = row.internalCost; // Use previous internal cost
            if (internalCost > 0) {
                const newMarginAmt = val - internalCost;
                updated.marginAmt = newMarginAmt;
                updated.marginPercent = (newMarginAmt / internalCost) * 100;
            }
            return updated; // Return immediately to avoid re-overwriting logic below
        }

        // Run calculation to sync internal fields
        // Pass 'null' for overrideMargin to use the row's own marginPercent
        return calculateRow(updated, null); 
    }));
  };

  // --- 3. SPECIAL: EDIT ROW AMOUNT (Reverse Calc) ---
  const handleRowAmountChange = (uid, newAmount) => {
      const amount = parseFloat(newAmount) || 0;
      setRows(rows.map(row => {
          if (row.uid !== uid) return row;
          const qty = row.qty || 1;
          const newRate = amount / qty;
          
          // Now update row with new Rate, and reverse calc margin
          const internalCost = row.internalCost;
          const newMarginAmt = newRate - internalCost;
          const newMarginPercent = internalCost > 0 ? (newMarginAmt / internalCost) * 100 : 0;

          return {
              ...row,
              quotedPrice: newRate,
              marginAmt: newMarginAmt,
              marginPercent: newMarginPercent
          };
      }));
  };

  // --- 4. GLOBAL UPDATES ---
  
  // A. Change Global Margin % -> Updates ALL rows
  const handleGlobalMarginChange = (newVal) => {
      const margin = parseFloat(newVal) || 0;
      setBaseMarginPercent(margin);
      
      setRows(rows.map(row => calculateRow(row, margin)));
  };

  // B. Change Grand Total -> Updates Margin -> Updates ALL rows
  const handleGrandTotalChange = (newTotal) => {
      const total = parseFloat(newTotal) || 0;
      
      // Prevent divide by zero
      if (grandTotalCost <= 0) {
          setGrandTotalProjectValue(total);
          return;
      }

      // Reverse Calc Global Margin
      // Total = Cost * (1 + Margin/100)
      // Margin = ((Total / Cost) - 1) * 100
      const newMargin = ((total / grandTotalCost) - 1) * 100;
      
      setBaseMarginPercent(newMargin);
      setRows(rows.map(row => calculateRow(row, newMargin)));
  };


  // --- 5. EFFECTS: CALCULATE TOTALS ---
  useEffect(() => {
      let costSum = 0;
      let valueSum = 0;

      rows.forEach(r => {
          // Total Cost for this row = Internal Unit Cost * Qty
          costSum += r.internalCost * r.qty;
          valueSum += r.quotedPrice * r.qty;
      });

      setGrandTotalCost(costSum);
      setGrandTotalProjectValue(valueSum);
      setGrandTotalProfit(valueSum - costSum);

  }, [rows]);


  // --- 6. RENDER HELPERS ---
  const moveCategory = (index, direction) => {
    const newOrder = [...categoryOrder];
    if (direction === 'up' && index > 0) {
        [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setCategoryOrder(newOrder);
  };

  // --- 7. SEARCH ---
  const searchResults = [];
  if (searchTerm.length > 0) {
    productCatalog.forEach(cat => {
        cat.items.forEach(item => {
            if (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                searchResults.push({ categoryId: cat.id, categoryName: cat.name, ...item });
            }
        });
    });
  }

  // --- 8. PDF ---
  const handleDownloadPDF = () => {
    setIsClientMode(true);
    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ margin: 5, filename: `Quote_${quoteNo}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save()
        .then(() => setIsClientMode(false));
    }, 500);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', minWidth: '1400px', backgroundColor: '#f5f5f5', paddingBottom:'150px' }}>
      
      {/* HEADER CONTROLS */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Quotation Manager v2.0</h2>
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
                placeholder="Search Item..." 
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

      {/* --- DOCUMENT --- */}
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
        <div style={{ marginBottom: '30px' }}>
            <strong style={{ display:'block', marginBottom:'5px', fontSize:'12px', color:'#888' }}>BILL TO:</strong>
            <input value={buyerName} onChange={e => setBuyerName(e.target.value)} style={{ width: '100%', fontWeight: 'bold', fontSize: '16px', border: '1px solid #eee', padding: '5px' }} />
            <textarea value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} style={{ width: '100%', marginTop: '5px', border: '1px solid #eee', padding: '5px', height: '60px', fontFamily:'inherit' }} />
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
                        <div style={{background:'#555'}}>Int.Cost</div>
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
                const catRows = rows.filter(r => r.categoryId === catId);
                if (catRows.length === 0 && isClientMode) return null;

                // --- SUBSECTION TOTALS CALCULATION ---
                let sub_FactVal = 0;
                let sub_TrnVal = 0;
                let sub_FitVal = 0;
                let sub_SadVal = 0;
                let sub_WorkVal = 0;
                let sub_IntCostVal = 0;
                let sub_MrgAmtVal = 0;
                let sub_Qty = 0;
                let sub_Amount = 0;
                let sub_Profit = 0;
                let sub_Gross = 0;

                catRows.forEach(r => {
                    const q = r.qty || 0;
                    sub_FactVal += r.factoryPrice * q;
                    sub_TrnVal += r.transAmt * q;
                    sub_FitVal += r.fittingCost * q;
                    sub_SadVal += r.saddleCost * q;
                    sub_WorkVal += r.workCost * q;
                    sub_IntCostVal += r.internalCost * q;
                    sub_MrgAmtVal += r.marginAmt * q;
                    sub_Qty += q;
                    sub_Amount += r.quotedPrice * q;
                    // Profit Per Unit * Qty
                    const prof = (r.quotedPrice - (r.internalCost + r.marginAmt)); 
                    sub_Profit += prof * q; // Actually this is Excess Profit over Margin
                    // Or did we mean Gross Profit (Price - Cost)? 
                    // Let's use standard Gross Profit: Price - InternalCost
                    sub_Gross += (r.quotedPrice - r.internalCost) * q;
                });

                return (
                    <div key={catId} style={{ marginTop: '10px' }}>
                        {/* HEADER */}
                        <div style={{ background: '#e9ecef', padding: '5px 10px', fontWeight: 'bold', borderBottom: '2px solid #ccc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{color:'#004085', textTransform:'uppercase'}}>{category?.name}</span>
                            {!isClientMode && (
                                <div>
                                    <button onClick={() => moveCategory(catIndex, 'up')} style={{ cursor:'pointer', marginRight:'5px' }}>⬆</button>
                                    <button onClick={() => moveCategory(catIndex, 'down')} style={{ cursor:'pointer' }}>⬇</button>
                                </div>
                            )}
                        </div>

                        {/* ROWS */}
                        {catRows.map((row, index) => {
                            const internalCost = row.internalCost;
                            const totalPerUnit = internalCost + row.marginAmt;
                            const rowAmount = row.qty * row.quotedPrice;
                            const profitPerUnit = row.quotedPrice - totalPerUnit; // Excess
                            const totalGross = (row.quotedPrice - internalCost) * row.qty;

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
                                            <div><input type="number" value={row.marginPercent.toFixed(1)} onChange={(e)=>updateRow(row.uid, 'marginPercent', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div><input type="number" value={row.marginAmt.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'marginAmt', e.target.value)} style={{width:'100%', border:'none', textAlign:'right', background:'transparent'}} /></div>
                                            <div style={{fontWeight:'bold', color:'#000'}}>{totalPerUnit.toFixed(0)}</div>
                                        </>
                                    )}

                                    {/* QTY */}
                                    <div>
                                        {isClientMode ? row.qty : <input type="number" value={row.qty} onChange={(e)=>updateRow(row.uid, 'qty', e.target.value)} style={{width:'100%', textAlign:'center', border:'1px solid #ddd'}} />}
                                    </div>
                                    <div style={{textAlign:'center'}}>{row.unit}</div>

                                    {/* RATE */}
                                    <div>
                                        {isClientMode ? row.quotedPrice.toFixed(2) : <input type="number" value={row.quotedPrice} onChange={(e)=>updateRow(row.uid, 'quotedPrice', e.target.value)} style={{width:'100%', textAlign:'right', fontWeight:'bold', border:'1px solid #ddd'}} />}
                                    </div>

                                    {/* AMOUNT (EDITABLE) */}
                                    <div>
                                        {isClientMode ? rowAmount.toLocaleString('en-IN') : 
                                         <input type="number" value={rowAmount.toFixed(2)} onChange={(e)=>handleRowAmountChange(row.uid, e.target.value)} style={{width:'100%', textAlign:'right', fontWeight:'bold', border:'none', background:'transparent'}} />
                                        }
                                    </div>

                                    {!isClientMode && (
                                        <>
                                            <div style={{color: profitPerUnit < 0 ? 'red' : '#aaa'}}>{profitPerUnit.toFixed(0)}</div>
                                            <div style={{color: totalGross < 0 ? 'red' : 'green', fontWeight:'bold'}}>{totalGross.toFixed(0)}</div>
                                            <div style={{textAlign:'center'}}><button onClick={()=>removeRow(row.uid)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>x</button></div>
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {/* SUBSECTION TOTALS ROW */}
                        {!isClientMode && (
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '30px 200px 50px 60px 60px 60px 60px 60px 60px 60px 60px 60px 70px 80px 70px 70px 80px',
                                background: '#ddd', 
                                fontWeight: 'bold', 
                                fontSize: '10px',
                                padding: '5px 0',
                                textAlign: 'right',
                                borderTop: '2px solid #999'
                            }}>
                                <div></div>
                                <div style={{textAlign:'left', paddingLeft:'5px'}}>SUB TOTAL</div>
                                
                                {/* Sums of Cost * Qty */}
                                <div>{sub_FactVal.toFixed(0)}</div>
                                <div></div>
                                <div>{sub_TrnVal.toFixed(0)}</div>
                                <div>{sub_FitVal.toFixed(0)}</div>
                                <div>{sub_SadVal.toFixed(0)}</div>
                                <div>{sub_WorkVal.toFixed(0)}</div>
                                <div>{sub_IntCostVal.toFixed(0)}</div>
                                <div></div>
                                <div>{sub_MrgAmtVal.toFixed(0)}</div>
                                <div></div>
                                
                                <div style={{textAlign:'center'}}>{sub_Qty}</div>
                                <div></div>
                                <div></div>
                                
                                {/* Main Totals */}
                                <div style={{fontSize:'11px'}}>{sub_Amount.toLocaleString('en-IN')}</div>
                                <div></div>
                                <div style={{color: sub_Gross < 0 ? 'red':'green'}}>{sub_Gross.toLocaleString('en-IN')}</div>
                                <div></div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        
        {/* GRAND FOOTER */}
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #ccc' }}>
                    <span>Sub Total:</span>
                    <strong>₹{grandTotalProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #ccc' }}>
                    <span>GST ({gstPercent}%):</span>
                    <span>₹{(grandTotalProjectValue * (gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#333', color: 'white', fontWeight: 'bold' }}>
                    <span>GRAND TOTAL:</span>
                    <span>₹{(grandTotalProjectValue * (1 + gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>
      </div>

      {/* FLOATING CONTROL BAR */}
      {!isClientMode && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background: '#333', color:'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>TOTAL INTERNAL COST</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{grandTotalCost.toLocaleString('en-IN')}</div>
          </div>
          
          <div style={{ textAlign: 'center', borderLeft:'1px solid #555', borderRight:'1px solid #555', padding:'0 20px' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>BASE MARGIN %</div>
            <input 
                type="number" 
                value={baseMarginPercent.toFixed(2)} 
                onChange={(e) => handleGlobalMarginChange(e.target.value)}
                style={{ fontSize: '20px', width: '90px', textAlign: 'center', background:'black', color:'white', border:'1px solid #555' }}
            />
            <div style={{fontSize:'11px', color:grandTotalProfit > 0 ? '#4caf50' : 'red'}}>
                Net Profit: ₹{grandTotalProfit.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>OVERRIDE SUB-TOTAL</div>
            <input 
              type="number" 
              value={grandTotalProjectValue.toFixed(2)} 
              onChange={(e) => handleGrandTotalChange(e.target.value)}
              style={{ fontSize: '20px', width: '150px', textAlign: 'right', background:'white', color:'black', border:'none', padding:'2px 5px' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}