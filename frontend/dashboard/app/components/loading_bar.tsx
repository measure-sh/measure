const LoadingBar: React.FC = () => {
    const loaderStyle: React.CSSProperties = {
        height: '4px',
        width: '100%',
        background: 'no-repeat linear-gradient(#0c0a09 0 0), no-repeat linear-gradient(#0c0a09 0 0), #a8a29e',
        backgroundSize: '60% 100%',
        animation: 'gradientMove 3s infinite',
    };

    return (
        <div style={loaderStyle}>
            <style>{`
          @keyframes gradientMove {
            0%   { background-position: -150% 0, -150% 0; }
            66%  { background-position: 250% 0, -150% 0; }
            100% { background-position: 250% 0, 250% 0; }
          }
        `}</style>
        </div>
    );
};

export default LoadingBar;