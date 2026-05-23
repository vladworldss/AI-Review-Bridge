function Popup() {
  return (
    <main
      style={{
        width: 240,
        padding: 12,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 13,
      }}
    >
      <h1 style={{ fontSize: 14, margin: '0 0 6px' }}>AI Review Bridge</h1>
      <p style={{ margin: 0, color: '#555' }}>
        Open a GitLab MR to see the sidebar.
      </p>
    </main>
  )
}

export default Popup
