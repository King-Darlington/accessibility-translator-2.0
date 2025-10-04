// Footer loading functionality
document.addEventListener('DOMContentLoaded', () => {
  const footerContainer = document.getElementById('footerContainer');
  
  if (footerContainer) {
    const footerHTML = `
      <div class="page-wrapper">
        <div id="waterdrop"></div>
        <footer>
          <div class="footer-top">
            <div class="pt-exebar"></div>
            <div class="container">
              <div class="row">
                <div class="col-lg-3 col-md-12 col-sm-12 footer-col-3">
                  <div class="widget footer_widget">
                    <h5 class="footer-title">Address</h5>
                    <div class="gem-contacts">
                      <div class="gem-contacts-item gem-contacts-address">Accessibility Translator<br> Douala, Cameroon</div>
                      <div class="gem-contacts-item gem-contacts-phone"><i class="fa fa-phone" aria-hidden="true"></i> Phone: <a href="tel:+237679545646">+237 679 545 646</a></div>
                      <div class="gem-contacts-item gem-contacts-address">Email: <a href="mailto:ngamfon.darlington@example.com">ngamfon.darlington@example.com</a></div>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-lg-6 col-md-6 col-sm-12">
                  <div class="row">
                    <div class="col-6 col-lg-6 col-md-6 col-sm-6">
                      <div class="widget footer_widget">
                        <h5 class="footer-title">Recent News</h5>
                        <ul class="posts styled">
                          <li class="clearfix gem-pp-posts">
                            <div class="gem-pp-posts-text">
                              <div class="gem-pp-posts-item">
                                <a href="#">Empowering Visually Impaired Users Worldwide</a>
                              </div>
                              <div class="gem-pp-posts-date">Contact: +237 679 545 646</div>
                            </div>
                          </li>
                          <li class="clearfix gem-pp-posts">
                            <div class="gem-pp-posts-text">
                              <div class="gem-pp-posts-item">
                                <a href="#">New Accessibility Features Released</a>
                              </div>
                              <div class="gem-pp-posts-date">Call +237 679 545 646</div>
                            </div>
                          </li>
                          <li class="clearfix gem-pp-posts">
                            <div class="gem-pp-posts-text">
                              <div class="gem-pp-posts-item">
                                <a href="#">Making Digital Content Accessible for All</a>
                              </div>
                              <div class="gem-pp-posts-date">Email us for more info</div>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div class="col-6 col-lg-6 col-md-6 col-sm-6">
                      <div class="widget">
                        <h5 class="footer-title">Contact Us</h5>
                        <div class="textwidget">
                          <div role="form" class="wpcf7" lang="en-US" dir="ltr">
                            <form method="post" novalidate>
                              <div class="contact-form-footer">
                                <p><input type="text" name="your-first-name" size="40" class="wpcf7-form-control wpcf7-text" aria-invalid="false" placeholder="Your name" /></p>
                                <p><input type="email" name="your-email_1" size="40" class="wpcf7-form-control wpcf7-text wpcf7-email wpcf7-validates-as-email" aria-invalid="false" placeholder="Your email" /></p>
                                <p><textarea name="your-message" cols="40" rows="10" class="wpcf7-form-control wpcf7-textarea" aria-invalid="false" placeholder="Your message"></textarea></p>
                                <div><input type="submit" value="Send" class="wpcf7-form-control wpcf7-submit" /><span class="ajax-loader"></span></div>
                              </div>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-lg-3 col-md-5 col-sm-12 footer-col-4">
                  <div class="widget widget_gallery gallery-grid-4">
                    <h5 class="footer-title">Our Gallery</h5>
                    <ul class="magnific-image">
                      <li><a class="magnific-anchor"><img src="src/assets/one.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/two.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/three.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/four.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/five.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/six.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/seven.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/eight.jpg" alt="Accessibility Translator Gallery" /></a></li>
                      <li><a class="magnific-anchor"><img src="src/assets/nine.jpg" alt="Accessibility Translator Gallery" /></a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <div class="container">
              <div class="row">
                <div class="col-md-3">
                  <div class="footer-site-info">2024 © <a href="#" target="_blank">Ngamfon Darlington</a></div>
                </div>
                <div class="col-md-6">
                  <nav id="footer-navigation" class="site-navigation footer-navigation centered-box" role="navigation">
                    <ul id="footer-menu" class="nav-menu styled clearfix inline-inside">
                      <li class="menu-item"><a href="index.html">Home</a></li>
                      <li class="menu-item"><a href="index.html#about">About</a></li>
                      <li class="menu-item"><a href="text-to-speech.html">Features</a></li>
                      <li class="menu-item"><a href="contact.html">Contact</a></li>
                    </ul>
                  </nav>
                </div>
                <div class="col-md-3">
                  <div id="footer-socials">
                    <div class="socials inline-inside socials-colored">
                      <a href="#" target="_blank" title="Facebook" class="socials-item">
                        <i class="fab fa-facebook-f facebook"></i>
                      </a>
                      <a href="#" target="_blank" title="Twitter" class="socials-item">
                        <i class="fab fa-twitter twitter"></i>
                      </a>
                      <a href="#" target="_blank" title="Instagram" class="socials-item">
                        <i class="fab fa-instagram instagram"></i>
                      </a>
                      <a href="#" target="_blank" title="LinkedIn" class="socials-item">
                        <i class="fab fa-linkedin-in linkedin"></i>
                      </a>
                      <a href="#" target="_blank" title="GitHub" class="socials-item">
                        <i class="fab fa-github github"></i>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    `;
    
    footerContainer.innerHTML = footerHTML;
    
    // Initialize waterdrop effect if jQuery and raindrops are available
    if (typeof jQuery !== 'undefined' && jQuery.fn.raindrops) {
      jQuery('#waterdrop').raindrops({
        color: '#1c1f2f',
        canvasHeight: 150,
        density: 0.1,
        frequency: 20
      });
    }
  }
});