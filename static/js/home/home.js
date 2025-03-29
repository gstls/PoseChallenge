function HeroSection() {
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth: width, innerHeight: height } = window;
      const offsetX = ((e.clientX - width / 2) / width) * 20;
      const offsetY = ((e.clientY - height / 2) / height) * 20;
      document.querySelector('.hero-content').style.transform = `rotateY(${offsetX}deg) rotateX(${offsetY}deg)`;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="hero-section">
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <h1 className="hero-title">Pose Game</h1>
        <p className="hero-subtitle">Strike a pose and let AI dazzle you!</p>
        <a href={startUrl} className="hero-btn">Start! 🚀</a>
      </div>

      <div className="help-icon">
        <span className="help-text">Help 🔍</span>
        <div className="tooltip-box">
          <p className="tooltip-description">Try these 3 poses for best results!</p>
          <div className="pose-item">
            <span role="img" aria-label="Chair Pose">🪑</span>
            <img src={CHAIR_URL} alt="Chair Pose" />
            <p>Chair</p>
          </div>
          <div className="pose-item">
            <span role="img" aria-label="Tree Pose">🌳</span>
            <img src={TREE_URL} alt="Tree Pose" />
            <p>Tree</p>
          </div>
          <div className="pose-item">
            <span role="img" aria-label="Warrior Pose">⚔️</span>
            <img src={WARRIOR_URL} alt="Warrior Pose" />
            <p>Warrior</p>
          </div>
          <div className="pose-item">
            <span role="img" aria-label="Dog Pose">⚔️</span>
            <img src={DOG_URL} alt="Dog Pose" />
            <p>Dog</p>
          </div>
          <div className="tooltip-controls">
            <p><strong>Controls:</strong></p>
            <p>W / A / S / D: Move camera Up / Left / Down / Right</p>
            <p>Q / E: Move camera Up / Down</p>
            <p><strong>Follow Skeleton</strong>: The third camera follows the skeleton from the front</p>
          </div>
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById('react-root')).render(<HeroSection />);
