'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

// Make sure ScrollTrigger is registered
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function ClientChatAnimation() {
  useEffect(() => {
    // Make sure we're on the client side
    if (typeof window === 'undefined') return;

    // Get the chat interface element from the upper section
    const chatInterface = document.querySelector(
      '.relative.z-10.rounded-lg.overflow-hidden.shadow-enhanced',
    );
    const animationContainer = document.getElementById(
      'chat-animation-container',
    );

    if (!chatInterface || !animationContainer) return;

    // Create a timeline for the chat interface animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: animationContainer,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        pin: chatInterface, // Pin the chat interface while scrolling
        anticipatePin: 1,
        onEnter: () => {
          // Add a class to chatInterface for additional styling during animation
          chatInterface.classList.add('chat-animating');
        },
        onLeaveBack: () => {
          chatInterface.classList.remove('chat-animating');
        },
      },
    });

    // Create a clone of the chat interface for morphing effects
    const clone = chatInterface.cloneNode(true) as HTMLElement;
    clone.classList.add('chat-clone');
    clone.style.position = 'absolute';
    clone.style.zIndex = '10';
    clone.style.opacity = '0';
    animationContainer.appendChild(clone);

    // Animate the chat interface
    tl.to(chatInterface, {
      scale: 0.9,
      y: 100,
      duration: 0.5,
      ease: 'power2.inOut',
    })
      .to(
        clone,
        {
          opacity: 1,
          duration: 0.3,
        },
        '-=0.2',
      )
      // Morph the clone into different states as we scroll
      .to(clone, {
        borderRadius: '1.5rem',
        width: '90vw',
        height: '60vh',
        x: 'calc(50% - 45vw)',
        y: 150,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        duration: 0.8,
      })
      // Animate morphing elements appearing
      .to(
        '.chat-morph-element',
        {
          opacity: 1,
          y: -20,
          stagger: 0.2,
          duration: 0.5,
        },
        '-=0.3',
      )
      // Grow the connection line
      .to(
        '.chat-connection-line',
        {
          opacity: 1,
          height: '40%',
          duration: 0.8,
        },
        '-=0.5',
      )
      // Animate the text bubble
      .to(
        '.chat-text-bubble',
        {
          opacity: 1,
          y: -20,
          duration: 0.5,
        },
        '-=0.3',
      )
      // Transform the clone interface further
      .to(clone, {
        borderRadius: '2rem',
        width: '95vw',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,118,0,0.1))',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255,255,255,0.2)',
        duration: 0.8,
      })
      // Create a web of connections between elements
      .to('.chat-connection-line', {
        opacity: 0.8,
        width: '3px',
        duration: 0.5,
      })
      .to(
        '.chat-morph-element',
        {
          scale: 1.2,
          boxShadow: '0 0 30px rgba(255,118,0,0.3)',
          stagger: 0.1,
          duration: 0.5,
        },
        '-=0.5',
      );

    // Add floating elements that connect with the chat interface
    const createFloatingElement = (
      x: number,
      y: number,
      size: number,
      color: string,
    ) => {
      const element = document.createElement('div');
      element.className = 'floating-element absolute rounded-full opacity-0';
      element.style.left = `${x}%`;
      element.style.top = `${y}%`;
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
      element.style.background = color;
      element.style.boxShadow = '0 0 20px rgba(255,255,255,0.2)';
      animationContainer.appendChild(element);

      // Animate each floating element
      gsap.to(element, {
        opacity: 0.7,
        duration: 0.5,
        delay: Math.random() * 0.5,
        scrollTrigger: {
          trigger: animationContainer,
          start: 'top 30%',
          end: 'center center',
          scrub: 1,
        },
      });

      // Add a continuous floating animation
      gsap.to(element, {
        y: `-=${10 + Math.random() * 20}`,
        x: `+=${Math.random() * 10 - 5}`,
        duration: 2 + Math.random() * 2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    };

    // Create multiple floating elements
    for (let i = 0; i < 12; i++) {
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      const size = 5 + Math.random() * 15;
      const colors = [
        'rgba(255,118,0,0.3)', // eos-orange
        'rgba(0,46,93,0.3)', // eos-navy
        'rgba(255,255,255,0.3)', // white
      ];
      createFloatingElement(
        x,
        y,
        size,
        colors[Math.floor(Math.random() * colors.length)],
      );
    }

    // Add connecting lines between floating elements and chat
    const createConnectingLine = () => {
      const line = document.createElement('div');
      line.className = 'connecting-line absolute opacity-0';
      line.style.height = '1px';
      line.style.width = '100px';
      line.style.background =
        'linear-gradient(90deg, rgba(255,118,0,0.5), rgba(255,255,255,0))';
      line.style.transformOrigin = 'left center';
      animationContainer.appendChild(line);

      // Random position and rotation
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      const rotation = Math.random() * 360;

      line.style.left = `${x}%`;
      line.style.top = `${y}%`;
      line.style.transform = `rotate(${rotation}deg)`;

      // Animate the line
      gsap.to(line, {
        opacity: 0.4,
        width: 50 + Math.random() * 150,
        duration: 0.8,
        delay: Math.random() * 0.5,
        scrollTrigger: {
          trigger: animationContainer,
          start: 'top 30%',
          end: 'center center',
          scrub: 1,
        },
      });
    };

    // Create multiple connecting lines
    for (let i = 0; i < 15; i++) {
      createConnectingLine();
    }

    // Clean up function
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    };
  }, []);

  return <div className="absolute inset-0 pointer-events-none" />;
}
