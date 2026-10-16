import React, { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import ReconciliationPortal from './components/ReconciliationPortal.jsx'
import {
  fetchTransactions,
  fetchLineItems,
  uploadCSV,
  approveMatch,
  rejectMatch,
  ignoreTransaction,
} from './api'

export default function App() {
  const [selectedOrg, setSelectedOrg] = useState('northwind')
  const [transactions, setTransactions] = useState([])
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorBanner, setErrorBanner] = useState('')

  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [activeActions, setActiveActions] = useState(new Set())

  const setActionRunning = (actionKey, isRunning) => {
    setActiveActions((prev) => {
      const next = new Set(prev)
      if (isRunning) next.add(actionKey)
      else next.delete(actionKey)
      return next
    })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorBanner('')
    try {
      const [txns, items] = await Promise.all([
        fetchTransactions(selectedOrg),
        fetchLineItems(selectedOrg),
      ])
      setTransactions(txns)
      setLineItems(items)
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load organization data.')
    } finally {
      setLoading(false)
    }
  }, [selectedOrg])

  useEffect(() => {
    setUploadResult(null)
    setSelectedFile(null)
    loadData()
  }, [loadData])

  const scrollToPortal = () => {
    const el = document.getElementById('portal')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      const fileInput = document.getElementById('portal-csv-file-input')
      if (fileInput) fileInput.focus()
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) return

    setUploading(true)
    setErrorBanner('')
    try {
      const { data } = await uploadCSV(selectedOrg, selectedFile)
      setUploadResult(data)
      setSelectedFile(null)
      const fileInput = document.getElementById('portal-csv-file-input')
      if (fileInput) fileInput.value = ''
      await loadData()
    } catch (err) {
      setErrorBanner(err.message || 'CSV upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleApprove = async (matchId) => {
    const key = `approve-${matchId}`
    setActionRunning(key, true)
    setErrorBanner('')
    try {
      await approveMatch(selectedOrg, matchId)
      await loadData()
    } catch (err) {
      setErrorBanner(err.message || 'Approval failed.')
    } finally {
      setActionRunning(key, false)
    }
  }

  const handleReject = async (matchId) => {
    const key = `reject-${matchId}`
    setActionRunning(key, true)
    setErrorBanner('')
    try {
      await rejectMatch(selectedOrg, matchId)
      await loadData()
    } catch (err) {
      setErrorBanner(err.message || 'Rejection failed.')
    } finally {
      setActionRunning(key, false)
    }
  }

  const handleIgnore = async (txnId) => {
    const key = `ignore-${txnId}`
    setActionRunning(key, true)
    setErrorBanner('')
    try {
      await ignoreTransaction(selectedOrg, txnId)
      await loadData()
    } catch (err) {
      setErrorBanner(err.message || 'Ignore failed.')
    } finally {
      setActionRunning(key, false)
    }
  }

  const totalCalled = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_called || 0), 0)
  const totalFunded = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_funded || 0), 0)
  const totalRemaining = totalCalled - totalFunded

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        onImportClick={scrollToPortal}
      />
      <main id="main">
        <Hero
          onGetStarted={scrollToPortal}
          totalCalled={totalCalled}
          totalFunded={totalFunded}
          totalRemaining={totalRemaining}
        />
        <ReconciliationPortal
          selectedOrg={selectedOrg}
          onSelectOrg={setSelectedOrg}
          transactions={transactions}
          lineItems={lineItems}
          loading={loading}
          errorBanner={errorBanner}
          setErrorBanner={setErrorBanner}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          uploading={uploading}
          uploadResult={uploadResult}
          setUploadResult={setUploadResult}
          activeActions={activeActions}
          handleUpload={handleUpload}
          handleApprove={handleApprove}
          handleReject={handleReject}
          handleIgnore={handleIgnore}
          loadData={loadData}
          totalCalled={totalCalled}
          totalFunded={totalFunded}
          totalRemaining={totalRemaining}
        />
      </main>
    </>
  )
}
