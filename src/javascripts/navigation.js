class Navigation {
  mount() {
    this.linkNodes = $('.navbar .nav-link');
    this.mobileNavNode = $('#mobile-nav-dropdown');
    this.mobileNavDropdownNode = this.mobileNavNode.find('.dropdown-menu');

    this.constructMobileNav();
  }

  constructMobileNav() {
    this.linkNodes.each((index, link) => {
      const linkNode = $(link);

      this.mobileNavDropdownNode.append(
        $('<a class="dropdown-item"></a>')
          .attr('href', linkNode.attr('href'))
          .text(linkNode.text().trim())
      );
    });
  }
}

export default Navigation;
